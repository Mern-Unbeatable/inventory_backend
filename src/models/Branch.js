import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const branchSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    name: { type: String, required: true, trim: true },
    code: { type: String, default: null },
    countryId: {
      type: String,
      required: true,
      ref: 'Country',
      index: true,
    },
  },
  { timestamps: true, collection: 'branches' }
);

applyIdTransform(branchSchema);

export const Branch = mongoose.model('Branch', branchSchema);
