import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const customerSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    notes: { type: String, default: null },
    // Set only when a CRM record is linked to a CUSTOMER-role portal login.
    userId: { type: String, ref: 'User' },
    createdBy: { type: String, required: true, ref: 'User' },
  },
  { timestamps: true, collection: 'customers' }
);

// Partial unique indexes — only index real string values. Omitting the field (CRM-only
// customers) must not collide; sparse indexes still index explicit null and break on
// the second CRM customer when schema defaults wrote userId/email as null.
customerSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true, $type: 'string' } },
  }
);
customerSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true, $type: 'string' } },
  }
);
customerSchema.index({ name: 1 });

applyIdTransform(customerSchema);

export const Customer = mongoose.model('Customer', customerSchema);
