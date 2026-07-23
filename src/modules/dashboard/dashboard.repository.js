import { Country } from '../../models/Country.js';
import { Branch } from '../../models/Branch.js';
import { User } from '../../models/User.js';
import { Product } from '../../models/Product.js';
import { UserProduct } from '../../models/UserProduct.js';
import { Sale } from '../../models/Sale.js';
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
      },
      countryBreakdown,
      recentSales: recentSaleDocs.map(mapAdminSale),
    };
  },

  async getSellerStats(userId) {
    const [assignments, stockAgg, lowStock, revenueAgg, unitsSoldAgg] =
      await Promise.all([
        UserProduct.countDocuments({ userId }),
        sumField(UserProduct, { userId }, 'quantity'),
        UserProduct.countDocuments({ userId, quantity: { $lte: 5 } }),
        sumField(Sale, { userId }, 'revenue'),
        sumField(Sale, { userId }, 'quantity'),
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
      },
      recentSales: recentSaleDocs.map(mapSellerSale),
    };
  },
};

export default dashboardRepository;
