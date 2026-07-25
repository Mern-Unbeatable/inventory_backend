import invoiceRepository from './invoice.repository.js';
import ApiError from '../../utils/ApiError.js';

const assertOwnership = (invoice, requester) => {
  if (requester.role === 'SELLER' && invoice.sellerId !== requester.id) {
    throw ApiError.forbidden('You can only manage your own invoices');
  }
  return invoice;
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
};

export default invoiceService;
