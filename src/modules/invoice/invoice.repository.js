import mongoose from 'mongoose';
import { Invoice } from '../../models/Invoice.js';
import { InvoiceItem } from '../../models/InvoiceItem.js';
import { Customer } from '../../models/Customer.js';
import { User } from '../../models/User.js';
import { Product } from '../../models/Product.js';
import { UserProduct } from '../../models/UserProduct.js';
import { Payment } from '../../models/Payment.js';
import { getNextSequence } from '../../models/Counter.js';
import { toApi } from '../../utils/mongooseHelpers.js';
import { containsInsensitive } from '../../utils/queryHelpers.js';
import { recordInventoryTransaction } from '../../utils/inventoryTransaction.js';

const invoicePopulate = [
  { path: 'customerId', select: 'name email phone' },
  { path: 'sellerId', select: 'name email' },
];

const mapInvoice = (doc, items) => {
  if (!doc) return null;
  const json = toApi(doc);
  const customer =
    json.customerId && typeof json.customerId === 'object' ? json.customerId : null;
  const seller = json.sellerId && typeof json.sellerId === 'object' ? json.sellerId : null;

  json.customerId = customer?.id ?? json.customerId;
  json.sellerId = seller?.id ?? json.sellerId;
  json.customer = customer;
  json.seller = seller;
  if (items) json.items = items;
  return json;
};

const mapInvoiceItem = (doc) => {
  const json = toApi(doc);
  const product =
    json.productId && typeof json.productId === 'object' ? json.productId : null;
  json.productId = product?.id ?? json.productId;
  json.product = product;
  return json;
};

const computeTotals = (items) => {
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return { totalAmount };
};

const generateInvoiceNumber = async () => {
  const seq = await getNextSequence('invoice');
  return `INV-${String(seq).padStart(6, '0')}`;
};

const invoiceRepository = {
  generateInvoiceNumber,

  /** Builds InvoiceItem input rows from {productId, quantity} using the product's current price. */
  async buildLineItems(items) {
    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).select('title sku price');
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const missing = productIds.filter((id) => !productMap.has(id));
    if (missing.length) {
      return { error: { type: 'PRODUCT_NOT_FOUND', productIds: missing } };
    }

    const lineItems = items.map((item) => {
      const product = productMap.get(item.productId);
      const unitPrice = product.price ?? 0;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
      };
    });

    return { lineItems };
  },

  /**
   * Returns seller inventory rows for the given product ids.
   * Used to validate assignment + available quantity before draft create/update.
   */
  async findSellerAssignments(sellerId, productIds) {
    const rows = await UserProduct.find({
      userId: sellerId,
      productId: { $in: productIds },
    }).select('productId quantity');

    return rows.map((row) => ({
      productId: String(row.productId),
      quantity: row.quantity,
    }));
  },

  async createDraft({ customerId, sellerId, notes, lineItems }) {
    const session = await mongoose.startSession();
    try {
      let created;
      await session.withTransaction(async () => {
        const invoiceNumber = await generateInvoiceNumber();
        const { totalAmount } = computeTotals(lineItems);

        const [invoice] = await Invoice.create(
          [
            {
              invoiceNumber,
              customerId,
              sellerId,
              notes: notes ?? null,
              totalAmount,
              paidAmount: 0,
              dueAmount: totalAmount,
              status: 'DRAFT',
              paymentStatus: 'UNPAID',
            },
          ],
          { session }
        );

        await InvoiceItem.insertMany(
          lineItems.map((item) => ({ ...item, invoiceId: invoice._id })),
          { session }
        );

        created = invoice._id;
      });

      return this.findById(created);
    } finally {
      await session.endSession();
    }
  },

  async findById(id) {
    const [invoice, itemDocs] = await Promise.all([
      Invoice.findById(id).populate(invoicePopulate),
      InvoiceItem.find({ invoiceId: id })
        .populate({ path: 'productId', select: 'title sku imageUrl price' })
        .sort({ createdAt: 1 }),
    ]);
    if (!invoice) return null;
    return mapInvoice(invoice, itemDocs.map(mapInvoiceItem));
  },

  async findMany({ filters = {}, skip = 0, take = 20 }) {
    const query = {};

    if (filters.customerId) query.customerId = filters.customerId;
    if (filters.sellerId) query.sellerId = filters.sellerId;
    if (filters.status) query.status = filters.status;
    if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;

    if (filters.search) {
      const customerIds = await Customer.find({
        $or: [
          { name: containsInsensitive(filters.search) },
          { email: containsInsensitive(filters.search) },
        ],
      }).distinct('_id');

      const orClauses = [
        { invoiceNumber: containsInsensitive(filters.search) },
        { customerId: { $in: customerIds } },
      ];

      if (query.customerId) {
        query.$and = [{ customerId: query.customerId }, { $or: orClauses }];
        delete query.customerId;
      } else {
        query.$or = orClauses;
      }
    }

    const [rows, total] = await Promise.all([
      Invoice.find(query)
        .populate(invoicePopulate)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      Invoice.countDocuments(query),
    ]);

    return { items: rows.map((row) => mapInvoice(row)), total };
  },

  async replaceItems(invoiceId, lineItems, notes) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await InvoiceItem.deleteMany({ invoiceId }, { session });
        await InvoiceItem.insertMany(
          lineItems.map((item) => ({ ...item, invoiceId })),
          { session }
        );

        const { totalAmount } = computeTotals(lineItems);
        const invoice = await Invoice.findById(invoiceId).session(session);
        const dueAmount = Math.max(totalAmount - invoice.paidAmount, 0);

        await Invoice.updateOne(
          { _id: invoiceId },
          {
            totalAmount,
            dueAmount,
            ...(notes !== undefined ? { notes } : {}),
          },
          { session }
        );
      });
      return this.findById(invoiceId);
    } finally {
      await session.endSession();
    }
  },

  async updateNotes(invoiceId, notes) {
    await Invoice.updateOne({ _id: invoiceId }, { notes });
    return this.findById(invoiceId);
  },

  /**
   * Transactionally deducts stock for every invoice item from the seller's
   * own inventory and confirms the invoice. Never allows negative stock —
   * aborts (and rethrows) if any item's guarded decrement fails.
   */
  async confirm(invoice, items, performedBy) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of items) {
          const before = await UserProduct.findOne({
            userId: invoice.sellerId,
            productId: item.productId,
          }).session(session);

          if (!before) {
            const error = new Error('NOT_ASSIGNED');
            error.productId = item.productId;
            throw error;
          }

          const updated = await UserProduct.findOneAndUpdate(
            { _id: before._id, quantity: { $gte: item.quantity } },
            { $inc: { quantity: -item.quantity } },
            { new: true, session }
          );

          if (!updated) {
            const error = new Error('INSUFFICIENT_STOCK');
            error.productId = item.productId;
            error.available = before.quantity;
            error.requested = item.quantity;
            throw error;
          }

          await recordInventoryTransaction(
            {
              userProductId: updated._id,
              userId: invoice.sellerId,
              productId: item.productId,
              type: 'SALE',
              beforeQuantity: before.quantity,
              changeQuantity: -item.quantity,
              afterQuantity: updated.quantity,
              reason: `Invoice ${invoice.invoiceNumber} confirmed`,
              performedBy,
            },
            { session }
          );
        }

        await Invoice.updateOne(
          { _id: invoice.id },
          { status: 'CONFIRMED', confirmedAt: new Date() },
          { session }
        );
      });

      return this.findById(invoice.id);
    } finally {
      await session.endSession();
    }
  },

  async cancel(invoiceId) {
    await Invoice.updateOne(
      { _id: invoiceId },
      { status: 'CANCELLED', cancelledAt: new Date() }
    );
    return this.findById(invoiceId);
  },

  async delete(invoiceId) {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return null;
    await Promise.all([
      InvoiceItem.deleteMany({ invoiceId }),
      Invoice.deleteOne({ _id: invoiceId }),
    ]);
    return mapInvoice(invoice);
  },

  /** Recomputes paidAmount/dueAmount/paymentStatus from the Payment ledger. Used by the payment module. */
  async recalculatePaymentStatus(invoiceId, { session } = {}) {
    const [agg] = await Payment.aggregate([
      { $match: { invoiceId } },
      { $group: { _id: null, paid: { $sum: '$amount' } } },
    ]).session(session ?? null);

    const paidAmount = agg?.paid ?? 0;
    const invoice = await Invoice.findById(invoiceId).session(session ?? null);
    if (!invoice) return null;

    const dueAmount = Math.max(invoice.totalAmount - paidAmount, 0);
    let paymentStatus = 'UNPAID';
    if (invoice.totalAmount <= 0 || paidAmount >= invoice.totalAmount) {
      paymentStatus = 'PAID';
    } else if (paidAmount > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    await Invoice.updateOne(
      { _id: invoiceId },
      { paidAmount, dueAmount, paymentStatus },
      { session }
    );

    return this.findById(invoiceId);
  },

  async userExists(userId) {
    const user = await User.findById(userId).select('name email role');
    if (!user) return null;
    return { id: user._id, role: user.role, name: user.name, email: user.email };
  },

  async listIdsBySeller(sellerId) {
    return Invoice.find({ sellerId }).distinct('_id');
  },

  async customerExists(customerId) {
    const customer = await Customer.findById(customerId).select('name email branchId');
    if (!customer) return null;
    return {
      id: customer._id,
      name: customer.name,
      email: customer.email,
      branchId: customer.branchId,
    };
  },

  /**
   * Rich context for PDF generation only — does not change getById API shape.
   * Includes customer address, seller branch/country, line items, and payments.
   */
  async findPdfContext(id) {
    const invoice = await this.findById(id);
    if (!invoice) return null;

    const [customerDoc, sellerDoc, paymentDocs] = await Promise.all([
      Customer.findById(invoice.customerId).select('name email phone address'),
      User.findById(invoice.sellerId)
        .select('name email branchId')
        .populate({
          path: 'branchId',
          select: 'name code countryId',
          populate: { path: 'countryId', select: 'name code' },
        }),
      Payment.find({ invoiceId: id }).sort({ paymentDate: 1, createdAt: 1 }),
    ]);

    const branchDoc =
      sellerDoc?.branchId && typeof sellerDoc.branchId === 'object'
        ? sellerDoc.branchId
        : null;
    const countryDoc =
      branchDoc?.countryId && typeof branchDoc.countryId === 'object'
        ? branchDoc.countryId
        : null;

    const branch = branchDoc
      ? {
          id: branchDoc._id,
          name: branchDoc.name,
          code: branchDoc.code,
          country: countryDoc
            ? {
                id: countryDoc._id,
                name: countryDoc.name,
                code: countryDoc.code,
              }
            : null,
        }
      : null;

    return {
      invoice,
      customer: customerDoc
        ? {
            id: customerDoc._id,
            name: customerDoc.name,
            email: customerDoc.email,
            phone: customerDoc.phone,
            address: customerDoc.address,
          }
        : invoice.customer,
      seller: sellerDoc
        ? {
            id: sellerDoc._id,
            name: sellerDoc.name,
            email: sellerDoc.email,
            branch,
          }
        : invoice.seller,
      payments: paymentDocs.map((doc) => toApi(doc)),
    };
  },
};

export default invoiceRepository;
