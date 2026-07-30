import invoiceRepository from './invoice.repository.js';
import ApiError from '../../utils/ApiError.js';

const assertOwnership = (invoice, requester) => {
  if (requester.role === 'SELLER' && invoice.sellerId !== requester.id) {
    throw ApiError.forbidden('You can only manage your own invoices');
  }
  return invoice;
};

/**
 * Ensures invoice line items are unique, assigned to the seller, and within stock.
 * Used on create/update (draft) so invalid invoices never enter the system;
 * confirm still re-checks atomically at stock deduction time.
 */
const assertSellerStockForItems = async (sellerId, items) => {
  const productIds = items.map((item) => item.productId);
  const uniqueIds = new Set(productIds);
  if (uniqueIds.size !== productIds.length) {
    throw ApiError.badRequest('Duplicate products are not allowed on an invoice', [
      { path: 'items', message: 'Each product may appear only once' },
    ]);
  }

  const assignments = await invoiceRepository.findSellerAssignments(
    sellerId,
    productIds
  );
  const stockByProduct = new Map(
    assignments.map((row) => [row.productId, row.quantity])
  );

  const errors = [];
  items.forEach((item, index) => {
    if (!stockByProduct.has(item.productId)) {
      errors.push({
        path: `items.${index}.productId`,
        message: 'Product is not assigned to this seller',
      });
      return;
    }

    const available = stockByProduct.get(item.productId);
    if (available <= 0) {
      errors.push({
        path: `items.${index}.productId`,
        message: 'Product is out of stock for this seller',
      });
      return;
    }

    if (item.quantity > available) {
      errors.push({
        path: `items.${index}.quantity`,
        message: `Quantity exceeds available stock (${available})`,
      });
    }
  });

  if (errors.length) {
    throw ApiError.badRequest('Invoice items failed inventory validation', errors);
  }
};

const invoiceService = {
  async create(payload, requester) {
    const customer = await invoiceRepository.customerExists(payload.customerId);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }

    let sellerId;
    if (requester.role === 'SELLER') {
      sellerId = requester.id;
      if (customer.branchId !== requester.branchId) {
        throw ApiError.forbidden('You can only invoice customers assigned to your branch');
      }
    } else {
      if (!payload.sellerId) {
        throw ApiError.badRequest('sellerId is required when an admin creates an invoice');
      }
      sellerId = payload.sellerId;
    }

    const seller = await invoiceRepository.userExists(sellerId);
    if (!seller) {
      throw ApiError.notFound('Seller not found');
    }
    if (seller.role !== 'SELLER') {
      throw ApiError.badRequest('Invoices can only be attributed to a seller');
    }

    const { lineItems, error } = await invoiceRepository.buildLineItems(payload.items);
    if (error) {
      throw ApiError.badRequest('One or more products were not found', [
        { path: 'items', message: `Unknown product id(s): ${error.productIds.join(', ')}` },
      ]);
    }

    await assertSellerStockForItems(sellerId, payload.items);

    return invoiceRepository.createDraft({
      customerId: payload.customerId,
      sellerId,
      notes: payload.notes,
      lineItems,
    });
  },

  async list(query, requester) {
    const { page, limit, customerId, sellerId, status, paymentStatus, search } = query;
    const skip = (page - 1) * limit;

    const effectiveSellerId = requester.role === 'SELLER' ? requester.id : sellerId;

    const { items, total } = await invoiceRepository.findMany({
      filters: { customerId, sellerId: effectiveSellerId, status, paymentStatus, search },
      skip,
      take: limit,
    });

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  },

  async getById(id, requester) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }
    return assertOwnership(invoice, requester);
  },

  async update(id, payload, requester) {
    const invoice = await this.getById(id, requester);
    if (invoice.status !== 'DRAFT') {
      throw ApiError.badRequest('Only draft invoices can be edited');
    }

    if (payload.items) {
      const { lineItems, error } = await invoiceRepository.buildLineItems(payload.items);
      if (error) {
        throw ApiError.badRequest('One or more products were not found', [
          { path: 'items', message: `Unknown product id(s): ${error.productIds.join(', ')}` },
        ]);
      }
      await assertSellerStockForItems(invoice.sellerId, payload.items);
      return invoiceRepository.replaceItems(id, lineItems, payload.notes);
    }

    return invoiceRepository.updateNotes(id, payload.notes);
  },

  async confirm(id, requester) {
    const invoice = await this.getById(id, requester);
    if (invoice.status !== 'DRAFT') {
      throw ApiError.badRequest(`Invoice is already ${invoice.status.toLowerCase()}`);
    }
    if (!invoice.items?.length) {
      throw ApiError.badRequest('Invoice has no items to confirm');
    }

    try {
      return await invoiceRepository.confirm(invoice, invoice.items, requester.id);
    } catch (error) {
      if (error?.message === 'NOT_ASSIGNED') {
        throw ApiError.badRequest(
          `Seller does not have product ${error.productId} assigned. Assign or receive stock first.`
        );
      }
      if (error?.message === 'INSUFFICIENT_STOCK') {
        throw ApiError.badRequest(
          `Insufficient stock for product ${error.productId}. Available: ${error.available}, requested: ${error.requested}`
        );
      }
      throw error;
    }
  },

  async cancel(id, requester) {
    const invoice = await this.getById(id, requester);
    if (invoice.status !== 'DRAFT') {
      throw ApiError.badRequest('Only draft invoices can be cancelled');
    }
    return invoiceRepository.cancel(id);
  },

  async remove(id, requester) {
    const invoice = await this.getById(id, requester);
    if (invoice.status !== 'DRAFT') {
      throw ApiError.badRequest('Only draft invoices can be deleted');
    }
    return invoiceRepository.delete(id);
  },

  /**
   * Loads PDF data after enforcing the same ownership rules as getById
   * (ADMIN: any invoice; SELLER: own invoices only).
   */
  async getPdfPayload(id, requester) {
    await this.getById(id, requester);

    const context = await invoiceRepository.findPdfContext(id);
    if (!context) {
      throw ApiError.notFound('Invoice not found');
    }

    return {
      filename: `${context.invoice.invoiceNumber}.pdf`,
      invoice: context.invoice,
      customer: context.customer,
      seller: context.seller,
      payments: context.payments,
    };
  },
};

export default invoiceService;
