import mongoose from "mongoose";
import { applyIdTransform, uuidPrimaryKey } from "../utils/mongooseHelpers.js";

/**
 * Isolated QR → Product mapping. Does NOT modify the Product schema/collection.
 * `productId` references an existing Product._id (UUID string) by value only.
 */
const productVerificationSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    qrId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    productId: { type: String, ref: "Product", required: true, index: true },
    status: {
      type: String,
      enum: ["ACTIVE", "DISABLED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true, collection: "product_verifications" },
);

applyIdTransform(productVerificationSchema);

export const ProductVerification = mongoose.model(
  "ProductVerification",
  productVerificationSchema,
);
