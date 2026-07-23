import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const userProductSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    userId: { type: String, required: true, ref: 'User', index: true },
    productId: { type: String, required: true, ref: 'Product', index: true },
    quantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'user_products' }
);

userProductSchema.index({ userId: 1, productId: 1 }, { unique: true });

applyIdTransform(userProductSchema);

export const UserProduct = mongoose.model('UserProduct', userProductSchema);
