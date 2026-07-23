import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const userSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'SELLER'], default: 'SELLER', index: true },
    branchId: { type: String, ref: 'Branch', default: null, index: true },
  },
  { timestamps: true, collection: 'users' }
);

applyIdTransform(userSchema);

export const User = mongoose.model('User', userSchema);
