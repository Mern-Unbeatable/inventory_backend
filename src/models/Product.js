import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const productSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    title: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: null },
    price: { type: Number, default: 0 },
    imageUrl: { type: String, default: null },
  },
  { timestamps: true, collection: 'products' }
);

applyIdTransform(productSchema);

export const Product = mongoose.model('Product', productSchema);
