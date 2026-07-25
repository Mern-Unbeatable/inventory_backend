import { UserProduct } from '../../models/UserProduct.js';
import { User } from '../../models/User.js';
import { Product } from '../../models/Product.js';
import { Branch } from '../../models/Branch.js';
import { Sale } from '../../models/Sale.js';
import { InventoryTransaction } from '../../models/InventoryTransaction.js';
import { toApi } from '../../utils/mongooseHelpers.js';
import { containsInsensitive } from '../../utils/queryHelpers.js';
import { recordInventoryTransaction } from '../../utils/inventoryTransaction.js';

const inventoryPopulate = [
  { path: 'productId' },
  {
    path: 'userId',
    select: 'name email role branchId',
    populate: {
      path: 'branchId',
      populate: { path: 'countryId' },
    },
  },
];

const mapInventoryRow = (doc) => {
  if (!doc) return null;
  const json = toApi(doc);

  const product =
    json.productId && typeof json.productId === 'object' ? json.productId : null;
  const user = json.userId && typeof json.userId === 'object' ? json.userId : null;

  json.productId = product?.id ?? json.productId;
  json.userId = user?.id ?? json.userId;
  json.product = product;

  if (user) {
    const branch =
      user.branchId && typeof user.branchId === 'object' ? user.branchId : null;
    const country =
      branch?.countryId && typeof branch.countryId === 'object'
        ? branch.countryId
        : null;

    json.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: branch?.id ?? user.branchId ?? null,
      branch: branch
        ? {
            id: branch.id,
            name: branch.name,
            code: branch.code,
            countryId: country?.id ?? branch.countryId ?? null,
            createdAt: branch.createdAt,
            updatedAt: branch.updatedAt,
            country,
          }
        : null,
    };
  } else {
    json.user = null;
  }

  return json;
};

const mapSale = (doc) => {
  if (!doc) return null;
  const json = toApi(doc);
  const product =
    json.productId && typeof json.productId === 'object' ? json.productId : null;
  const user = json.userId && typeof json.userId === 'object' ? json.userId : null;

  json.productId = product?.id ?? json.productId;
  json.userId = user?.id ?? json.userId;
  json.product = product;
  json.user = user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        branchId: user.branchId ?? null,
      }
    : null;
  return json;
};

const inventoryRepository = {
  async assign({ userId, productId, quantity }) {
    const row = await UserProduct.create({ userId, productId, quantity });
    const populated = await UserProduct.findById(row._id).populate(inventoryPopulate);
    return mapInventoryRow(populated);
  },

  async findById(id) {
    const row = await UserProduct.findById(id).populate(inventoryPopulate);
    return mapInventoryRow(row);
  },

  async findByUserAndProduct(userId, productId) {
    const row = await UserProduct.findOne({ userId, productId }).populate(
      inventoryPopulate
    );
    return mapInventoryRow(row);
  },

  async findMany({ filters = {}, skip = 0, take = 20 }) {
    const query = {};

    if (filters.userId) query.userId = filters.userId;
    if (filters.productId) query.productId = filters.productId;

    let userIdsFilter = null;

    if (filters.branchId || filters.countryId) {
      let branchQuery = {};
      if (filters.branchId) branchQuery._id = filters.branchId;
      if (filters.countryId) {
        branchQuery.countryId = filters.countryId;
      }
      const branchIds = await Branch.find(branchQuery).distinct('_id');
      userIdsFilter = await User.find({ branchId: { $in: branchIds } }).distinct('_id');
      query.userId = { $in: userIdsFilter };
    }

    if (filters.search) {
      const [productIds, matchedUserIds] = await Promise.all([
        Product.find({
          $or: [
            { title: containsInsensitive(filters.search) },
            { sku: containsInsensitive(filters.search) },
          ],
        }).distinct('_id'),
        User.find({
          $or: [
            { name: containsInsensitive(filters.search) },
            { email: containsInsensitive(filters.search) },
          ],
        }).distinct('_id'),
      ]);

      const orClauses = [
        { productId: { $in: productIds } },
        { userId: { $in: matchedUserIds } },
      ];

      if (query.userId) {
        query.$and = [{ userId: query.userId }, { $or: orClauses }];
        delete query.userId;
      } else {
        query.$or = orClauses;
      }
    }

    const [rows, total] = await Promise.all([
      UserProduct.find(query)
        .populate(inventoryPopulate)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(take),
      UserProduct.countDocuments(query),
    ]);

    return { items: rows.map(mapInventoryRow), total };
  },

  async findByUserId(userId) {
    const rows = await UserProduct.find({ userId })
      .populate({ path: 'productId' })
      .sort({ updatedAt: -1 });

    return rows.map((row) => {
      const json = toApi(row);
      const product =
        json.productId && typeof json.productId === 'object' ? json.productId : null;
      json.productId = product?.id ?? json.productId;
      json.product = product;
      return json;
    });
  },

  async updateQuantity(id, quantity, ledger) {
    const row = await UserProduct.findByIdAndUpdate(
      id,
      { quantity },
      { new: true }
    ).populate(inventoryPopulate);

    if (ledger) {
      await recordInventoryTransaction({
        userProductId: row._id,
        userId: row.userId,
        productId: row.productId,
        type: ledger.type,
        beforeQuantity: ledger.beforeQuantity,
        changeQuantity: quantity - ledger.beforeQuantity,
        afterQuantity: quantity,
        reason: ledger.reason,
        performedBy: ledger.performedBy,
      });
    }

    return mapInventoryRow(row);
  },

  /** Increases stock (staff "receiving" a delivery) — logs a RECEIVED transaction. */
  async receiveStock({ inventoryId, quantity, performedBy, reason }) {
    const before = await UserProduct.findById(inventoryId);
    if (!before) throw new Error('NOT_FOUND');

    const updated = await UserProduct.findByIdAndUpdate(
      inventoryId,
      { $inc: { quantity } },
      { new: true }
    ).populate(inventoryPopulate);

    await recordInventoryTransaction({
      userProductId: updated._id,
      userId: updated.userId,
      productId: updated.productId,
      type: 'RECEIVED',
      beforeQuantity: before.quantity,
      changeQuantity: quantity,
      afterQuantity: updated.quantity,
      reason: reason ?? 'Stock received',
      performedBy,
    });

    return mapInventoryRow(updated);
  },

  async recordSale({ inventoryId, soldQuantity, unitPrice, userId, productId, performedBy }) {
    const revenue = soldQuantity * unitPrice;

    const updated = await UserProduct.findOneAndUpdate(
      { _id: inventoryId, quantity: { $gte: soldQuantity } },
      { $inc: { quantity: -soldQuantity } },
      { new: true }
    );

    if (!updated) {
      const exists = await UserProduct.findById(inventoryId);
      if (!exists) throw new Error('NOT_FOUND');
      throw new Error('INSUFFICIENT_STOCK');
    }

    const previousQuantity = updated.quantity + soldQuantity;

    await recordInventoryTransaction({
      userProductId: updated._id,
      userId,
      productId,
      type: 'SALE',
      beforeQuantity: previousQuantity,
      changeQuantity: -soldQuantity,
      afterQuantity: updated.quantity,
      reason: 'Direct sale',
      performedBy: performedBy ?? userId,
    });

    const saleDoc = await Sale.create({
      userId,
      productId,
      userProductId: inventoryId,
      quantity: soldQuantity,
      unitPrice,
      revenue,
    });

    const [inventory, sale] = await Promise.all([
      UserProduct.findById(inventoryId).populate(inventoryPopulate),
      Sale.findById(saleDoc._id)
        .populate({ path: 'productId' })
        .populate({ path: 'userId', select: 'name email branchId' }),
    ]);

    return {
      inventory: mapInventoryRow(inventory),
      sale: mapSale(sale),
      previousQuantity,
    };
  },

  async delete(id) {
    const row = await UserProduct.findById(id).populate(inventoryPopulate);
    if (!row) return null;
    const mapped = mapInventoryRow(row);
    await UserProduct.deleteOne({ _id: id });
    return mapped;
  },

  async userExists(userId) {
    const user = await User.findById(userId).select('name email role branchId');
    if (!user) return null;
    return {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      branchId: user.branchId,
    };
  },

  async productExists(productId) {
    const product = await Product.findById(productId).select('title sku');
    if (!product) return null;
    return { id: product._id, title: product.title, sku: product.sku };
  },

  async findTransactions({ filters = {}, skip = 0, take = 20 }) {
    const query = {};
    if (filters.userProductId) query.userProductId = filters.userProductId;
    if (filters.userId) query.userId = filters.userId;
    if (filters.productId) query.productId = filters.productId;
    if (filters.type) query.type = filters.type;

    const [rows, total] = await Promise.all([
      InventoryTransaction.find(query)
        .populate({ path: 'productId', select: 'title sku' })
        .populate({ path: 'performedBy', select: 'name email role' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      InventoryTransaction.countDocuments(query),
    ]);

    const items = rows.map((row) => {
      const json = toApi(row);
      const product =
        json.productId && typeof json.productId === 'object' ? json.productId : null;
      const performer =
        json.performedBy && typeof json.performedBy === 'object' ? json.performedBy : null;
      json.productId = product?.id ?? json.productId;
      json.product = product;
      json.performedBy = performer?.id ?? json.performedBy;
      json.performedByUser = performer;
      return json;
    });

    return { items, total };
  },
};

export default inventoryRepository;
