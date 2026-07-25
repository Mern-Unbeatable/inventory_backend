import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const customerSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: null },
    phone: { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    notes: { type: String, default: null },
    // Optional link to a CUSTOMER-role User account for portal login.
    userId: { type: String, ref: 'User', default: null },
    createdBy: { type: String, required: true, ref: 'User' },
  },
  { timestamps: true, collection: 'customers' }
);

customerSchema.index({ email: 1 }, { unique: true, sparse: true });
customerSchema.index({ userId: 1 }, { unique: true, sparse: true });
customerSchema.index({ name: 1 });

applyIdTransform(customerSchema);

export const Customer = mongoose.model('Customer', customerSchema);
