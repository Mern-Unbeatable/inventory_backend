import { Payment } from '../../models/Payment.js';
import { toApi } from '../../utils/mongooseHelpers.js';

const mapPayment = (doc) => {
  if (!doc) return null;
  const json = toApi(doc);
  const invoice =
    json.invoiceId && typeof json.invoiceId === 'object' ? json.invoiceId : null;
  json.invoiceId = invoice?.id ?? json.invoiceId;
  if (invoice) json.invoice = invoice;
  return json;
};

const paymentRepository = {
  async create(data) {
    const payment = await Payment.create(data);
    return mapPayment(payment);
  },

  async findById(id) {
    const payment = await Payment.findById(id).populate({
      path: 'invoiceId',
      select: 'invoiceNumber status paymentStatus totalAmount sellerId customerId',
    });
    return mapPayment(payment);
  },

  async findMany({ filters = {}, skip = 0, take = 20 }) {
    const query = {};
    if (filters.invoiceId) query.invoiceId = filters.invoiceId;
    else if (filters.invoiceIds) query.invoiceId = { $in: filters.invoiceIds };

    const [rows, total] = await Promise.all([
      Payment.find(query)
        .populate({ path: 'invoiceId', select: 'invoiceNumber status paymentStatus' })
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(take),
      Payment.countDocuments(query),
    ]);

    return { items: rows.map(mapPayment), total };
  },

  async delete(id) {
    const payment = await Payment.findById(id);
    if (!payment) return null;
    await Payment.deleteOne({ _id: id });
    return mapPayment(payment);
  },
};

export default paymentRepository;
