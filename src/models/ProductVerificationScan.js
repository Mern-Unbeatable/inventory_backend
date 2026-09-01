import mongoose from "mongoose";
import { applyIdTransform, uuidPrimaryKey } from "../utils/mongooseHelpers.js";

/**
 * Append-only scan log for a ProductVerification. Provides traceability
 * (total scans, first/last scan) without ever mutating existing data.
 */
const productVerificationScanSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    verificationId: {
      type: String,
      ref: "ProductVerification",
      required: true,
      index: true,
    },
    scannedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, collection: "product_verification_scans" },
);

applyIdTransform(productVerificationScanSchema);

export const ProductVerificationScan = mongoose.model(
  "ProductVerificationScan",
  productVerificationScanSchema,
);
