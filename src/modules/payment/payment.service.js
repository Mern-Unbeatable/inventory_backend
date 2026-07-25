import paymentRepository from './payment.repository.js';
import invoiceRepository from '../invoice/invoice.repository.js';
import ApiError from '../../utils/ApiError.js';

const assertInvoiceOwnership = (invoice, requester) => {
  if (requester.role === 'SELLER' && invoice.sellerId !== requester.id) {
    throw ApiError.forbidden('You can only manage payments for your own invoices');
  }
  return invoice;
};

const paymentService = {
  async create(payload, requester) {
    const invoice = await invoiceRepository.findById(payload.invoiceId);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }
    assertInvoiceOwnership(invoice, requester);

    if (invoice.status !== 'CONFIRMED') {
      throw ApiError.badRequest('Only confirmed invoices can receive payments');
    }
    if (payload.amount > invoice.dueAmount) {
      throw ApiError.badRequest(
        `Amount exceeds the remaining due balance (${invoice.dueAmount})`
      );
    }

    const payment = await paymentRepository.create({
      invoiceId: payload.invoiceId,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      paymentDate: payload.paymentDate ?? new Date(),
      notes: payload.notes ?? null,
      recordedBy: requester.id,
    });

    const updatedInvoice = await invoiceRepository.recalculatePaymentStatus(payload.invoiceId);

    return { payment, invoice: updatedInvoice };
  },

  async list(query, requester) {
    const { page, limit, invoiceId } = query;
    const skip = (page - 1) * limit;

    let effectiveInvoiceIds;

    if (invoiceId) {
      const invoice = await invoiceRepository.findById(invoiceId);
      if (!invoice) {
        throw ApiError.notFound('Invoice not found');
      }
      assertInvoiceOwnership(invoice, requester);
    } else if (requester.role === 'SELLER') {
      effectiveInvoiceIds = await invoiceRepository.listIdsBySeller(requester.id);
    }

    const { items, total } = await paymentRepository.findMany({
      filters: {
        invoiceId,
        ...(effectiveInvoiceIds ? { invoiceIds: effectiveInvoiceIds } : {}),
      },
      skip,
      take: limit,
    });

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  },

  async getById(id, requester) {
    const payment = await paymentRepository.findById(id);
    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }
    if (requester.role === 'SELLER' && payment.invoice?.sellerId !== requester.id) {
      throw ApiError.forbidden('You can only view payments for your own invoices');
    }
    return payment;
  },

  async remove(id) {
    const payment = await paymentRepository.findById(id);
    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }

    await paymentRepository.delete(id);
    const invoiceId = payment.invoice?.id ?? payment.invoiceId;
    const updatedInvoice = await invoiceRepository.recalculatePaymentStatus(invoiceId);

    return { deleted: true, invoice: updatedInvoice };
  },
};

export default paymentService;
