import { Product } from '../../models/Product.js';
import { UserProduct } from '../../models/UserProduct.js';
import { Sale } from '../../models/Sale.js';
import { toApi } from '../../utils/mongooseHelpers.js';
import { containsInsensitive } from '../../utils/queryHelpers.js';
import { deleteStoredFile } from '../../utils/fileStorage.js';

const withAssignedCount = async (doc) => {
  if (!doc) return null;
  const json = toApi(doc);
  const assignedUsers = await UserProduct.countDocuments({ productId: json.id });
  json._count = { assignedUsers };
  return json;
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
  return json;
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

  async findBySku(sku) {
    const product = await Product.findOne({ sku });
    return product ? toApi(product) : null;
  },

  async findMany({ filters = {}, skip = 0, take = 20, sellerId = null }) {
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

    if (sellerId) {
      const productIds = await UserProduct.find({ userId: sellerId }).distinct('productId');
      query._id = { $in: productIds };
    }

    const [rows, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(take),
      Product.countDocuments(query),
    ]);

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
