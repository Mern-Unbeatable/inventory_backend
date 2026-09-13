import verificationRepository from "./verification.repository.js";
import productRepository from "../product/product.repository.js";
import { Product } from "../../models/Product.js";
import ApiError from "../../utils/ApiError.js";

const normalizeQrId = (qrId) => qrId.trim().toUpperCase();

const isSeller = (requester) => requester?.role === "SELLER";

/**
 * Sellers may only use products they own (ownerId) or are assigned (UserProduct).
 * Admins are unrestricted.
 */
const assertSellerCanUseProduct = async (productId, requester) => {
  if (!isSeller(requester)) return;

  const allowed = await productRepository.isAccessibleBySeller(
    productId,
    requester.id,
  );
  if (!allowed) {
    throw ApiError.forbidden(
      "You can only manage verification mappings for your assigned or owned products",
    );
  }
};

const assertSellerCanAccessVerification = async (doc, requester) => {
  if (!doc) {
    throw ApiError.notFound("Verification not found");
  }
  await assertSellerCanUseProduct(doc.productId, requester);
};

const verificationService = {
  // ---- Authenticated management (ADMIN + SELLER) ----
  async create(payload, requester) {
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

    await assertSellerCanUseProduct(payload.productId, requester);

    const productMapped = await verificationRepository.findByProductId(
      payload.productId,
    );
    if (productMapped) {
      throw ApiError.conflict(
        "This product already has a QR mapping. Choose a different product.",
      );
    }

    return verificationRepository.create({
      qrId,
      productId: payload.productId,
      status: payload.status || "ACTIVE",
    });
  },

  async list(query, requester) {
    const { page, limit, status, search } = query;
    const skip = (page - 1) * limit;

    const filters = { status, search };

    if (isSeller(requester)) {
      const productIds =
        await productRepository.findAccessibleProductIdsForSeller(requester.id);
      // No eligible products → empty page (do not leak other sellers' mappings).
      if (!productIds.length) {
        return {
          items: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 1,
          },
        };
      }
      filters.productIds = productIds;
    }

    const { items, total } = await verificationRepository.findMany({
      filters,
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

  async getById(id, requester) {
    const doc = await verificationRepository.findById(id);
    if (!doc) {
      throw ApiError.notFound("Verification not found");
    }
    await assertSellerCanAccessVerification(doc, requester);
    return verificationRepository.toDetail(doc);
  },

  async update(id, payload, requester) {
    const doc = await verificationRepository.findById(id);
    if (!doc) {
      throw ApiError.notFound("Verification not found");
    }
    await assertSellerCanAccessVerification(doc, requester);

    if (payload.productId) {
      const productExists = await verificationRepository.existsForProduct(
        payload.productId,
      );
      if (!productExists) {
        throw ApiError.badRequest("Selected product does not exist");
      }

      await assertSellerCanUseProduct(payload.productId, requester);

      const productMapped = await verificationRepository.findByProductId(
        payload.productId,
      );
      if (productMapped && String(productMapped._id) !== String(id)) {
        throw ApiError.conflict(
          "This product already has a QR mapping. Choose a different product.",
        );
      }
    }

    return verificationRepository.update(id, {
      ...(payload.productId ? { productId: payload.productId } : {}),
      ...(payload.status ? { status: payload.status } : {}),
    });
  },

  async remove(id, requester) {
    const doc = await verificationRepository.findById(id);
    if (!doc) {
      throw ApiError.notFound("Verification not found");
    }
    await assertSellerCanAccessVerification(doc, requester);

    const removed = await verificationRepository.remove(id);
    return removed;
  },

  async bulkRemove(ids, requester) {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) {
      throw ApiError.badRequest("At least one verification ID is required");
    }

    const docs = await verificationRepository.findManyByIds(uniqueIds);
    const existingIds = docs.map((doc) => doc.id || doc._id);
    const missingIds = uniqueIds.filter(
      (id) => !existingIds.map(String).includes(String(id)),
    );

    if (missingIds.length) {
      throw ApiError.notFound(
        `Some verification records could not be found: ${missingIds.join(", ")}`,
      );
    }

    if (isSeller(requester)) {
      for (const doc of docs) {
        await assertSellerCanAccessVerification(doc, requester);
      }
    }

    const deletedCount = await verificationRepository.bulkRemove(uniqueIds);
    return { deletedCount, ids: uniqueIds };
  },

  // ---- Public verification (no auth) ----
  async verifyByQrId(rawQrId, { recordScan = true } = {}) {
    const qrId = normalizeQrId(rawQrId);
    const verification = await verificationRepository.findByQrId(qrId);

    if (!verification) {
      throw ApiError.notFound("This QR code is not recognized");
    }

    if (verification.status === "DISABLED") {
      throw ApiError.forbidden("This verification code has been disabled");
    }

    const product = await Product.findById(verification.productId).select(
      "title imageUrl",
    );
    if (!product) {
      throw ApiError.notFound("The referenced product is no longer available");
    }

    const scan = recordScan
      ? await verificationRepository.recordScan(verification._id)
      : await (async () => {
          const stats = await verificationRepository.getScanStats(
            verification._id,
          );
          return {
            ...stats,
            // Revisit without recording — treat any prior scan as not "first".
            isFirstScan: stats.totalScans === 0,
          };
        })();

    // Expose ONLY safe, customer-facing fields — never price, stock, seller, etc.
    return {
      verified: true,
      qrId: verification.qrId,
      productName: product.title,
      productImageUrl: product.imageUrl || null,
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
