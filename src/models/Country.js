import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const countrySchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, unique: true, sparse: true, default: null },
  },
  { timestamps: true, collection: 'countries' }
);

applyIdTransform(countrySchema);

export const Country = mongoose.model('Country', countrySchema);
