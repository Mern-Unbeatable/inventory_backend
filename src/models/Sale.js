import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const saleSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    userId: { type: String, required: true, ref: 'User', index: true },
    productId: { type: String, required: true, ref: 'Product', index: true },
    userProductId: { type: String, default: null },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    revenue: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: 'sales', updatedAt: false }
);

applyIdTransform(saleSchema);

export const Sale = mongoose.model('Sale', saleSchema);
