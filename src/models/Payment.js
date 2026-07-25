import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const paymentSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    invoiceId: { type: String, required: true, ref: 'Invoice', index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'OTHER'],
      default: 'CASH',
    },
    notes: { type: String, default: null },
    recordedBy: { type: String, required: true, ref: 'User' },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: 'payments', updatedAt: false }
);

applyIdTransform(paymentSchema);

export const Payment = mongoose.model('Payment', paymentSchema);
