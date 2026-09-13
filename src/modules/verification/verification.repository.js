import { ProductVerification } from "../../models/ProductVerification.js";
import { ProductVerificationScan } from "../../models/ProductVerificationScan.js";
import { Product } from "../../models/Product.js";
import { toApi } from "../../utils/mongooseHelpers.js";
import { containsInsensitive } from "../../utils/queryHelpers.js";

/** Aggregate scan stats for one or many verification ids. */
const scanStatsFor = async (verificationIds) => {
  if (!verificationIds.length) return new Map();
  const rows = await ProductVerificationScan.aggregate([
    { $match: { verificationId: { $in: verificationIds } } },
    {
      $group: {
        _id: "$verificationId",
        totalScans: { $sum: 1 },
        firstScannedAt: { $min: "$scannedAt" },
        lastScannedAt: { $max: "$scannedAt" },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, row]));
};

const emptyStats = { totalScans: 0, firstScannedAt: null, lastScannedAt: null };

const verificationRepository = {
  async findByQrId(qrId) {
    return ProductVerification.findOne({ qrId });
  },

  async findById(id) {
    return ProductVerification.findById(id);
  },

  async findByProductId(productId) {
    return ProductVerification.findOne({ productId });
  },

  async existsForProduct(productId) {
    return Product.exists({ _id: productId });
  },

  async create(data) {
    const doc = await ProductVerification.create(data);
    return this.toDetail(doc);
  },

  async update(id, data) {
    const doc = await ProductVerification.findByIdAndUpdate(id, data, {
      new: true,
    });
    return doc ? this.toDetail(doc) : null;
  },

  async remove(id) {
    const doc = await ProductVerification.findById(id);
    if (!doc) return null;
    await ProductVerificationScan.deleteMany({ verificationId: id });
    await ProductVerification.deleteOne({ _id: id });
    return toApi(doc);
  },

  async findManyByIds(ids) {
    return ProductVerification.find({ _id: { $in: ids } }).select(
      "_id productId",
    );
  },

  async bulkRemove(ids) {
    const docs = await ProductVerification.find({ _id: { $in: ids } }).select(
      "_id",
    );
    if (!docs.length) return 0;

    await Promise.all(
      docs.map((doc) =>
        ProductVerificationScan.deleteMany({ verificationId: doc._id }),
      ),
    );

    const result = await ProductVerification.deleteMany({ _id: { $in: ids } });
    return result.deletedCount || 0;
  },

  /** Read aggregated scan stats without creating a scan record. */
  async getScanStats(verificationId) {
    const stats = (await scanStatsFor([verificationId])).get(verificationId);
    return stats || emptyStats;
  },

  /** Append a scan record and return the aggregated stats for this verification. */
  async recordScan(verificationId) {
    const priorCount = await ProductVerificationScan.countDocuments({
      verificationId,
    });
    const scan = await ProductVerificationScan.create({ verificationId });
    const stats = (await scanStatsFor([verificationId])).get(
      verificationId,
    ) || {
      ...emptyStats,
      totalScans: 1,
      firstScannedAt: scan.scannedAt,
      lastScannedAt: scan.scannedAt,
    };
    return { isFirstScan: priorCount === 0, ...stats };
  },

  /** Enrich a single verification doc with product summary + scan stats. */
  async toDetail(doc) {
    if (!doc) return null;
    const json = toApi(doc);
    const [product, statsMap] = await Promise.all([
      Product.findById(json.productId).select("title sku imageUrl"),
      scanStatsFor([json.id]),
    ]);
    const stats = statsMap.get(json.id) || emptyStats;
    return {
      ...json,
      product: product
        ? {
            id: product._id,
            title: product.title,
            sku: product.sku,
            imageUrl: product.imageUrl,
          }
        : null,
      totalScans: stats.totalScans,
      firstScannedAt: stats.firstScannedAt,
      lastScannedAt: stats.lastScannedAt,
    };
  },

  async findMany({ filters = {}, skip = 0, take = 10 }) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      query.qrId = containsInsensitive(filters.search);
    }
    if (filters.productIds) {
      query.productId = { $in: filters.productIds };
    }

    const [rows, total] = await Promise.all([
      ProductVerification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      ProductVerification.countDocuments(query),
    ]);

    const ids = rows.map((row) => row._id);
    const productIds = rows.map((row) => row.productId);
    const [statsMap, products] = await Promise.all([
      scanStatsFor(ids),
      Product.find({ _id: { $in: productIds } }).select("title sku imageUrl"),
    ]);
    const productMap = new Map(
      products.map((p) => [
        p._id,
        { id: p._id, title: p.title, sku: p.sku, imageUrl: p.imageUrl },
      ]),
    );

    const items = rows.map((row) => {
      const json = toApi(row);
      const stats = statsMap.get(json.id) || emptyStats;
      return {
        ...json,
        product: productMap.get(json.productId) || null,
        totalScans: stats.totalScans,
        firstScannedAt: stats.firstScannedAt,
        lastScannedAt: stats.lastScannedAt,
      };
    });

    return { items, total };
  },
};

export default verificationRepository;
