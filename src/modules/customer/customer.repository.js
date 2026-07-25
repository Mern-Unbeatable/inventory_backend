import { Customer } from '../../models/Customer.js';
import { Invoice } from '../../models/Invoice.js';
import { InvoiceItem } from '../../models/InvoiceItem.js';
import { toApi } from '../../utils/mongooseHelpers.js';
import { containsInsensitive } from '../../utils/queryHelpers.js';

const mapCustomer = (doc) => {
  if (!doc) return null;
  return toApi(doc);
};

const customerRepository = {
  async create(data) {
    const customer = await Customer.create(data);
    return mapCustomer(customer);
  },

  async findById(id) {
    const customer = await Customer.findById(id);
    return mapCustomer(customer);
  },

  async findByEmail(email) {
    const customer = await Customer.findOne({ email });
    return mapCustomer(customer);
  },

  async findMany({ filters = {}, skip = 0, take = 20 }) {
    const query = {};

    if (filters.search) {
      query.$or = [
        { name: containsInsensitive(filters.search) },
        { email: containsInsensitive(filters.search) },
        { phone: containsInsensitive(filters.search) },
      ];
    }

    const [rows, total] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(take),
      Customer.countDocuments(query),
    ]);

    return { items: rows.map(mapCustomer), total };
  },

  async update(id, data) {
    const customer = await Customer.findByIdAndUpdate(id, data, { new: true });
    return mapCustomer(customer);
  },

  async delete(id) {
    const customer = await Customer.findById(id);
    if (!customer) return null;
    await Customer.deleteOne({ _id: id });
    return mapCustomer(customer);
  },

  async invoiceCount(customerId) {
    return Invoice.countDocuments({ customerId });
  },

  async linkPortalAccount(id, userId) {
    const customer = await Customer.findByIdAndUpdate(id, { userId }, { new: true });
    return mapCustomer(customer);
  },

  /** Sum of dueAmount across the customer's confirmed (unpaid/partial) invoices. */
  async getOutstandingBalance(customerId) {
    const [row] = await Invoice.aggregate([
      { $match: { customerId, status: 'CONFIRMED' } },
      { $group: { _id: null, outstanding: { $sum: '$dueAmount' } } },
    ]);
    return row?.outstanding ?? 0;
  },

  async findInvoicesByCustomer(customerId, { status, skip = 0, take = 20 }) {
    const query = { customerId };
    if (status) query.status = status;

    const [rows, total] = await Promise.all([
      Invoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(take),
      Invoice.countDocuments(query),
    ]);

    return { items: rows.map((row) => toApi(row)), total };
  },

  /** Line-item purchase history across the customer's confirmed invoices. */
  async getPurchaseHistory(customerId, { skip = 0, take = 20 }) {
    const invoiceIds = await Invoice.find({
      customerId,
      status: 'CONFIRMED',
    }).distinct('_id');

    if (!invoiceIds.length) {
      return { items: [], total: 0 };
    }

    const query = { invoiceId: { $in: invoiceIds } };

    const [rows, total] = await Promise.all([
      InvoiceItem.find(query)
        .populate({ path: 'productId', select: 'title sku imageUrl' })
        .populate({ path: 'invoiceId', select: 'invoiceNumber createdAt confirmedAt' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      InvoiceItem.countDocuments(query),
    ]);

    const items = rows.map((row) => {
      const json = toApi(row);
      const product =
        json.productId && typeof json.productId === 'object' ? json.productId : null;
      const invoice =
        json.invoiceId && typeof json.invoiceId === 'object' ? json.invoiceId : null;

      return {
        id: json.id,
        quantity: json.quantity,
        unitPrice: json.unitPrice,
        lineTotal: json.lineTotal,
        product,
        invoice: invoice
          ? {
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              confirmedAt: invoice.confirmedAt,
            }
          : null,
      };
    });

    return { items, total };
  },
};

export default customerRepository;
