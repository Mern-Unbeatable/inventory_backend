import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const invoiceSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    invoiceNumber: { type: String, required: true, unique: true },
    customerId: { type: String, required: true, ref: 'Customer', index: true },
    sellerId: { type: String, required: true, ref: 'User', index: true },
    status: {
      type: String,
      enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
      default: 'UNPAID',
      index: true,
    },
    notes: { type: String, default: null },
    totalAmount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    confirmedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'invoices' }
);

applyIdTransform(invoiceSchema);

export const Invoice = mongoose.model('Invoice', invoiceSchema);
