import { Country } from '../../models/Country.js';
import { Branch } from '../../models/Branch.js';
import { User } from '../../models/User.js';
import { Product } from '../../models/Product.js';
import { UserProduct } from '../../models/UserProduct.js';
import { Sale } from '../../models/Sale.js';
import { Customer } from '../../models/Customer.js';
import { Invoice } from '../../models/Invoice.js';
import { InventoryTransaction } from '../../models/InventoryTransaction.js';
import { getSellerIdsByCountry } from '../../utils/countryScope.js';
import { toApi } from '../../utils/mongooseHelpers.js';

const sumField = async (Model, match, field) => {
  const [row] = await Model.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $group: { _id: null, total: { $sum: `$${field}` }, count: { $sum: 1 } } },
  ]);
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
};

const mapAdminSale = (doc) => {
  const json = toApi(doc);
  const product =
    json.productId && typeof json.productId === 'object' ? json.productId : null;
  const user = json.userId && typeof json.userId === 'object' ? json.userId : null;
  const branch =
    user?.branchId && typeof user.branchId === 'object' ? user.branchId : null;
  const country =
    branch?.countryId && typeof branch.countryId === 'object'
      ? branch.countryId
      : null;

  return {
    id: json.id,
    userId: user?.id ?? json.userId,
    productId: product?.id ?? json.productId,
    userProductId: json.userProductId,
    quantity: json.quantity,
    unitPrice: json.unitPrice,
    revenue: json.revenue,
    createdAt: json.createdAt,
    product,
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          branch: branch
            ? {
                id: branch.id,
                name: branch.name,
                country,
              }
            : null,
        }
      : null,
  };
};

const mapSellerSale = (doc) => {
  const json = toApi(doc);
  const product =
    json.productId && typeof json.productId === 'object' ? json.productId : null;
  return {
    id: json.id,
    userId: json.userId,
    productId: product?.id ?? json.productId,
    userProductId: json.userProductId,
    quantity: json.quantity,
    unitPrice: json.unitPrice,
    revenue: json.revenue,
    createdAt: json.createdAt,
    product,
  };
};

const getTopSellingProducts = async (limit = 5) => {
  const rows = await Sale.aggregate([
    { $group: { _id: '$productId', unitsSold: { $sum: '$quantity' }, revenue: { $sum: '$revenue' } } },
    { $sort: { unitsSold: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
  ]);

  return rows.map((row) => ({
    productId: row._id,
    title: row.product?.title ?? 'Unknown product',
    sku: row.product?.sku ?? null,
    unitsSold: row.unitsSold,
    revenue: row.revenue,
  }));
};

const dashboardRepository = {
  async getAdminStats() {
    const [
      countries,
      branches,
      users,
      sellers,
      products,
      assignments,
      stockAgg,
      lowStock,
      revenueAgg,
      unitsSoldAgg,
      customers,
      invoices,
      outstandingDueAgg,
      topSellingProducts,
    ] = await Promise.all([
      Country.countDocuments(),
      Branch.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ role: 'SELLER' }),
      Product.countDocuments(),
      UserProduct.countDocuments(),
      sumField(UserProduct, {}, 'quantity'),
      UserProduct.countDocuments({ quantity: { $lte: 5 } }),
      sumField(Sale, {}, 'revenue'),
      sumField(Sale, {}, 'quantity'),
      Customer.countDocuments(),
      Invoice.countDocuments(),
      sumField(Invoice, { status: 'CONFIRMED' }, 'dueAmount'),
      getTopSellingProducts(),
    ]);

    const stockByCountry = await Country.find().sort({ name: 1 }).lean();
    const countryBreakdown = [];

    for (const country of stockByCountry) {
      const countryBranches = await Branch.find({ countryId: country._id }).lean();
      let totalQuantity = 0;
      let revenue = 0;
      let unitsSold = 0;
      let sellerCount = 0;

      for (const branch of countryBranches) {
        const branchUsers = await User.find({ branchId: branch._id })
          .select('_id')
          .lean();
        sellerCount += branchUsers.length;
        const userIds = branchUsers.map((u) => u._id);

        if (userIds.length) {
          const [stock, sales] = await Promise.all([
            sumField(UserProduct, { userId: { $in: userIds } }, 'quantity'),
            sumField(Sale, { userId: { $in: userIds } }, 'revenue'),
          ]);
          const units = await sumField(Sale, { userId: { $in: userIds } }, 'quantity');
          totalQuantity += stock.total;
          revenue += sales.total;
          unitsSold += units.total;
        }
      }

      countryBreakdown.push({
        id: country._id,
        name: country.name,
        code: country.code,
        branchCount: countryBranches.length,
        sellerCount,
        totalQuantity,
        revenue,
        unitsSold,
      });
    }

    const recentSaleDocs = await Sale.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate({ path: 'productId', select: 'title sku price' })
      .populate({
        path: 'userId',
        select: 'name email branchId',
        populate: {
          path: 'branchId',
          select: 'name countryId',
          populate: { path: 'countryId' },
        },
      });

    return {
      totals: {
        countries,
        branches,
        users,
        sellers,
        products,
        assignments,
        totalStockQuantity: stockAgg.total,
        revenue: revenueAgg.total,
        unitsSold: unitsSoldAgg.total,
        salesCount: revenueAgg.count,
        lowStockAssignments: lowStock,
        customers,
        invoices,
        outstandingDue: outstandingDueAgg.total,
      },
      countryBreakdown,
      topSellingProducts,
      recentSales: recentSaleDocs.map(mapAdminSale),
    };
  },

  async getSellerStats(userId) {
    const [
      assignments,
      stockAgg,
      lowStock,
      revenueAgg,
      unitsSoldAgg,
      receivedUnitsAgg,
      invoiceCount,
      pendingInvoicesDueAgg,
    ] = await Promise.all([
      UserProduct.countDocuments({ userId }),
      sumField(UserProduct, { userId }, 'quantity'),
      UserProduct.countDocuments({ userId, quantity: { $lte: 5 } }),
      sumField(Sale, { userId }, 'revenue'),
      sumField(Sale, { userId }, 'quantity'),
      sumField(InventoryTransaction, { userId, type: 'RECEIVED' }, 'changeQuantity'),
      Invoice.countDocuments({ sellerId: userId }),
      sumField(Invoice, { sellerId: userId, status: 'CONFIRMED' }, 'dueAmount'),
    ]);

    const recentSaleDocs = await Sale.find({ userId })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate({ path: 'productId', select: 'title sku price' });

    return {
      totals: {
        assignedProducts: assignments,
        totalStockQuantity: stockAgg.total,
        revenue: revenueAgg.total,
        unitsSold: unitsSoldAgg.total,
        salesCount: revenueAgg.count,
        lowStockProducts: lowStock,
        receivedUnits: receivedUnitsAgg.total,
        invoiceCount,
        pendingInvoicesDue: pendingInvoicesDueAgg.total,
      },
      recentSales: recentSaleDocs.map(mapSellerSale),
    };
  },

  /** Customer portal: read-only catalog snapshot scoped to the customer's country. */
  async getCustomerStats(countryId) {
    if (!countryId) {
      return {
        totals: {
          availableProducts: 0,
          totalStockAcrossCatalog: 0,
        },
        products: [],
      };
    }

    const sellerIds = await getSellerIdsByCountry(countryId);
    if (!sellerIds.length) {
      return {
        totals: {
          availableProducts: 0,
          totalStockAcrossCatalog: 0,
        },
        products: [],
      };
    }

    const productIds = await UserProduct.find({
      userId: { $in: sellerIds },
    }).distinct('productId');

    const [availableProducts, stockAgg] = await Promise.all([
      Product.countDocuments({ _id: { $in: productIds } }),
      UserProduct.aggregate([
        { $match: { userId: { $in: sellerIds } } },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]),
    ]);

    const productDocs = await Product.find({ _id: { $in: productIds } })
      .sort({ createdAt: -1 })
      .limit(12);
    const scopedProductIds = productDocs.map((p) => p._id);
    const stockRows = await UserProduct.aggregate([
      { $match: { productId: { $in: scopedProductIds }, userId: { $in: sellerIds } } },
      { $group: { _id: '$productId', total: { $sum: '$quantity' } } },
    ]);
    const stockMap = new Map(stockRows.map((r) => [r._id, r.total]));

    const products = productDocs.map((p) => {
      const json = toApi(p);
      return {
        id: json.id,
        title: json.title,
        sku: json.sku,
        price: json.price,
        imageUrl: json.imageUrl,
        availableQuantity: stockMap.get(json.id) ?? 0,
      };
    });

    return {
      totals: {
        availableProducts,
        totalStockAcrossCatalog: stockAgg[0]?.total ?? 0,
      },
      products,
    };
  },
};

export default dashboardRepository;
