import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const invoiceItemSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    invoiceId: { type: String, required: true, ref: 'Invoice', index: true },
    productId: { type: String, required: true, ref: 'Product', index: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: 'invoice_items' }
);

applyIdTransform(invoiceItemSchema);

export const InvoiceItem = mongoose.model('InvoiceItem', invoiceItemSchema);
