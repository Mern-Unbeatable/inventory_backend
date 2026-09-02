import verificationRepository from "./verification.repository.js";
import { Product } from "../../models/Product.js";
import ApiError from "../../utils/ApiError.js";

const normalizeQrId = (qrId) => qrId.trim().toUpperCase();

const verificationService = {
  // ---- Admin ----
  async create(payload) {
    const qrId = normalizeQrId(payload.qrId);

    const existing = await verificationRepository.findByQrId(qrId);
    if (existing) {
      throw ApiError.conflict("A verification with this QR ID already exists");
    }

    const productExists = await verificationRepository.existsForProduct(
      payload.productId,
    );
    if (!productExists) {
      throw ApiError.badRequest("Selected product does not exist");
    }

    return verificationRepository.create({
      qrId,
      productId: payload.productId,
      status: payload.status || "ACTIVE",
    });
  },

  async list(query) {
    const { page, limit, status, search } = query;
    const skip = (page - 1) * limit;

    const { items, total } = await verificationRepository.findMany({
      filters: { status, search },
      skip,
      take: limit,
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async getById(id) {
    const doc = await verificationRepository.findById(id);
    if (!doc) {
      throw ApiError.notFound("Verification not found");
    }
    return verificationRepository.toDetail(doc);
  },

  async update(id, payload) {
    const doc = await verificationRepository.findById(id);
    if (!doc) {
      throw ApiError.notFound("Verification not found");
    }

    if (payload.productId) {
      const productExists = await verificationRepository.existsForProduct(
        payload.productId,
      );
      if (!productExists) {
        throw ApiError.badRequest("Selected product does not exist");
      }
    }

    return verificationRepository.update(id, {
      ...(payload.productId ? { productId: payload.productId } : {}),
      ...(payload.status ? { status: payload.status } : {}),
    });
  },

  async remove(id) {
    const removed = await verificationRepository.remove(id);
    if (!removed) {
      throw ApiError.notFound("Verification not found");
    }
    return removed;
  },

  async bulkRemove(ids) {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) {
      throw ApiError.badRequest("At least one verification ID is required");
    }

    const docs = await verificationRepository.findManyByIds(uniqueIds);
    const existingIds = docs.map((doc) => doc.id);
    const missingIds = uniqueIds.filter((id) => !existingIds.includes(id));

    if (missingIds.length) {
      throw ApiError.notFound(
        `Some verification records could not be found: ${missingIds.join(", ")}`,
      );
    }

    const deletedCount = await verificationRepository.bulkRemove(uniqueIds);
    return { deletedCount, ids: uniqueIds };
  },

  // ---- Public verification (no auth) ----
  async verifyByQrId(rawQrId) {
    const qrId = normalizeQrId(rawQrId);
    const verification = await verificationRepository.findByQrId(qrId);

    if (!verification) {
      throw ApiError.notFound("This QR code is not recognized");
    }

    if (verification.status === "DISABLED") {
      throw ApiError.forbidden("This verification code has been disabled");
    }

    const product = await Product.findById(verification.productId).select(
      "title",
    );
    if (!product) {
      throw ApiError.notFound("The referenced product is no longer available");
    }

    const scan = await verificationRepository.recordScan(verification._id);

    // Expose ONLY safe, customer-facing fields — never price, stock, seller, etc.
    return {
      verified: true,
      qrId: verification.qrId,
      productName: product.title,
      brand: null, // Product schema has no brand field; kept null intentionally.
      status: verification.status,
      isFirstScan: scan.isFirstScan,
      totalScans: scan.totalScans,
      firstScannedAt: scan.firstScannedAt,
      lastScannedAt: scan.lastScannedAt,
    };
  },
};

export default verificationService;
