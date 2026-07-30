import { Customer } from '../../models/Customer.js';
import { Invoice } from '../../models/Invoice.js';
import { InvoiceItem } from '../../models/InvoiceItem.js';
import { toApi } from '../../utils/mongooseHelpers.js';
import { containsInsensitive } from '../../utils/queryHelpers.js';

const customerPopulate = [
  { path: 'countryId', select: 'name code' },
  { path: 'branchId', select: 'name code countryId' },
  { path: 'createdBy', select: 'name email role' },
];

const mapCustomer = (doc) => {
  if (!doc) return null;
  const json = toApi(doc);

  const country =
    json.countryId && typeof json.countryId === 'object' ? json.countryId : null;
  if (country) {
    json.country = country;
    json.countryId = country.id;
  }

  const branch =
    json.branchId && typeof json.branchId === 'object' ? json.branchId : null;
  if (branch) {
    json.branch = {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      countryId:
        branch.countryId && typeof branch.countryId === 'object'
          ? branch.countryId.id
          : branch.countryId,
    };
    json.branchId = branch.id;
  }

  const creator =
    json.createdBy && typeof json.createdBy === 'object' ? json.createdBy : null;
  if (creator) {
    json.creator = {
      id: creator.id,
      name: creator.name,
      email: creator.email,
      role: json.createdByRole || creator.role,
    };
    json.createdBy = creator.id;
  }

  return json;
};

const customerRepository = {
  async create(data) {
    const customer = await Customer.create(data);
    const populated = await Customer.findById(customer._id).populate(customerPopulate);
    return mapCustomer(populated);
  },

  async findById(id) {
    const customer = await Customer.findById(id).populate(customerPopulate);
    return mapCustomer(customer);
  },

  async findByEmail(email) {
    const customer = await Customer.findOne({ email }).populate(customerPopulate);
    return mapCustomer(customer);
  },

  async findByUserId(userId) {
    const customer = await Customer.findOne({ userId }).populate(customerPopulate);
    return mapCustomer(customer);
  },

  async findCountryIdByUserId(userId) {
    const customer = await Customer.findOne({ userId }).select('countryId');
    return customer?.countryId ?? null;
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

    if (filters.branchId) {
      query.branchId = filters.branchId;
    }

    if (filters.countryId) {
      query.countryId = filters.countryId;
    }

    const [rows, total] = await Promise.all([
      Customer.find(query)
        .populate(customerPopulate)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      Customer.countDocuments(query),
    ]);

    return { items: rows.map(mapCustomer), total };
  },

  async update(id, data) {
    const customer = await Customer.findByIdAndUpdate(id, data, { new: true }).populate(
      customerPopulate
    );
    return mapCustomer(customer);
  },

  async delete(id) {
    const customer = await Customer.findById(id).populate(customerPopulate);
    if (!customer) return null;
    await Customer.deleteOne({ _id: id });
    return mapCustomer(customer);
  },

  async invoiceCount(customerId) {
    return Invoice.countDocuments({ customerId });
  },

  async linkPortalAccount(id, userId) {
    const customer = await Customer.findByIdAndUpdate(id, { userId }, { new: true }).populate(
      customerPopulate
    );
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
