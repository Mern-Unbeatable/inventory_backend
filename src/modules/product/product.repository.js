import { Product } from '../../models/Product.js';
import { User } from '../../models/User.js';
import { UserProduct } from '../../models/UserProduct.js';
import { Sale } from '../../models/Sale.js';
import { toApi } from '../../utils/mongooseHelpers.js';
import { containsInsensitive } from '../../utils/queryHelpers.js';
import { deleteStoredFile } from '../../utils/fileStorage.js';
import { getSellerIdsByCountry } from '../../utils/countryScope.js';

const attachOwner = async (json) => {
  if (!json) return null;
  if (!json.ownerId) {
    json.owner = null;
    return json;
  }

  const owner = await User.findById(json.ownerId).select('name email role');
  json.owner = owner
    ? {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
      }
    : null;
  return json;
};

const withAssignedCount = async (doc) => {
  if (!doc) return null;
  const json = toApi(doc);
  const assignments = await UserProduct.find({ productId: json.id }).select(
    '_id quantity'
  );
  const assignedUsers = assignments.length;
  const totalQuantity = assignments.reduce((sum, row) => sum + row.quantity, 0);

  json._count = { assignedUsers };
  json.totalQuantity = totalQuantity;

  if (assignedUsers === 1) {
    json.quantity = assignments[0].quantity;
    json.assignmentId = assignments[0]._id;
  } else {
    json.quantity = totalQuantity;
    json.assignmentId = null;
  }

  return attachOwner(json);
};

const withSellerAssignment = async (doc, sellerId) => {
  if (!doc) return null;
  const json = toApi(doc);
  const assignment = await UserProduct.findOne({
    productId: json.id,
    userId: sellerId,
  }).select('_id quantity updatedAt');

  json.assignedUsers = assignment
    ? [{ id: assignment._id, quantity: assignment.quantity, updatedAt: assignment.updatedAt }]
    : [];
  return attachOwner(json);
};

/** Customer-facing shape: only name/sku/price/image + total stock company-wide (no per-seller detail). */
const toCustomerShape = (json, availableQuantity) => ({
  id: json.id,
  title: json.title,
  sku: json.sku,
  price: json.price,
  imageUrl: json.imageUrl,
  availableQuantity: availableQuantity ?? 0,
});

const withAvailableQuantity = async (doc, { sellerIds = null } = {}) => {
  if (!doc) return null;
  const json = toApi(doc);
  const match = { productId: json.id };
  if (sellerIds?.length) {
    match.userId = { $in: sellerIds };
  }

  const [row] = await UserProduct.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$quantity' } } },
  ]);
  return toCustomerShape(json, row?.total ?? 0);
};

const productRepository = {
  async create(data) {
    const product = await Product.create(data);
    return withAssignedCount(product);
  },

  async findById(id) {
    const product = await Product.findById(id);
    return withAssignedCount(product);
  },

  async findByIdForSeller(id, userId) {
    const assignment = await UserProduct.findOne({ productId: id, userId });
    if (!assignment) return null;
    const product = await Product.findById(id);
    return withSellerAssignment(product, userId);
  },

  async findByIdForCustomer(id, { countryId = null } = {}) {
    const product = await Product.findById(id);
    if (!product) return null;

    const sellerIds = countryId ? await getSellerIdsByCountry(countryId) : null;
    if (countryId && !sellerIds.length) {
      return null;
    }

    if (countryId) {
      const assigned = await UserProduct.exists({
        productId: id,
        userId: { $in: sellerIds },
      });
      if (!assigned) return null;
    }

    return withAvailableQuantity(product, { sellerIds });
  },

  async findBySku(sku) {
    const product = await Product.findOne({ sku });
    return product ? toApi(product) : null;
  },

  async findMany({
    filters = {},
    skip = 0,
    take = 20,
    sellerId = null,
    forCustomer = false,
    countryId = null,
  }) {
    const query = {};

    if (filters.search) {
      query.$or = [
        { title: containsInsensitive(filters.search) },
        { sku: containsInsensitive(filters.search) },
        { description: containsInsensitive(filters.search) },
      ];
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) query.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) query.price.$lte = filters.maxPrice;
    }

    let countrySellerIds = null;

    if (sellerId) {
      const productIds = await UserProduct.find({ userId: sellerId }).distinct('productId');
      query._id = { $in: productIds };
    }

    if (forCustomer && countryId) {
      countrySellerIds = await getSellerIdsByCountry(countryId);
      if (!countrySellerIds.length) {
        return { items: [], total: 0 };
      }

      const productIds = await UserProduct.find({
        userId: { $in: countrySellerIds },
      }).distinct('productId');

      query._id = query._id
        ? { $in: productIds.filter((id) => query._id.$in.includes(id)) }
        : { $in: productIds };
    }

    const [rows, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(take),
      Product.countDocuments(query),
    ]);

    if (forCustomer) {
      const ids = rows.map((row) => row._id);
      const stockMatch = { productId: { $in: ids } };
      if (countrySellerIds?.length) {
        stockMatch.userId = { $in: countrySellerIds };
      }

      const stockRows = await UserProduct.aggregate([
        { $match: stockMatch },
        { $group: { _id: '$productId', total: { $sum: '$quantity' } } },
      ]);
      const stockMap = new Map(stockRows.map((r) => [r._id, r.total]));
      const items = rows.map((row) => toCustomerShape(toApi(row), stockMap.get(row._id) ?? 0));
      return { items, total };
    }

    const items = sellerId
      ? await Promise.all(rows.map((row) => withSellerAssignment(row, sellerId)))
      : await Promise.all(rows.map((row) => withAssignedCount(row)));

    return { items, total };
  },

  async update(id, data) {
    const product = await Product.findByIdAndUpdate(id, data, { new: true });
    return withAssignedCount(product);
  },

  async delete(id) {
    const product = await Product.findById(id);
    if (!product) return null;

    await UserProduct.deleteMany({ productId: id });
    await Sale.deleteMany({ productId: id });
    await Product.deleteOne({ _id: id });

    if (product.imageUrl) {
      deleteStoredFile(product.imageUrl);
    }

    return toApi(product);
  },
};

export default productRepository;
