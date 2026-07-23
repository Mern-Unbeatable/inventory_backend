import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const refreshTokenSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    token: { type: String, required: true, unique: true },
    userId: { type: String, required: true, ref: 'User', index: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'refresh_tokens', updatedAt: false }
);

applyIdTransform(refreshTokenSchema);

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
