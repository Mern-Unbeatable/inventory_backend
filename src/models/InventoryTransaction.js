import mongoose from 'mongoose';
import { applyIdTransform, uuidPrimaryKey } from '../utils/mongooseHelpers.js';

const inventoryTransactionSchema = new mongoose.Schema(
  {
    _id: uuidPrimaryKey,
    userProductId: { type: String, required: true, ref: 'UserProduct', index: true },
    userId: { type: String, required: true, ref: 'User', index: true },
    productId: { type: String, required: true, ref: 'Product', index: true },
    type: {
      type: String,
      enum: ['RECEIVED', 'SALE', 'ADJUSTMENT', 'MANUAL_UPDATE'],
      required: true,
      index: true,
    },
    beforeQuantity: { type: Number, required: true },
    changeQuantity: { type: Number, required: true },
    afterQuantity: { type: Number, required: true },
    reason: { type: String, default: null },
    performedBy: { type: String, required: true, ref: 'User' },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: 'inventory_transactions', updatedAt: false }
);

applyIdTransform(inventoryTransactionSchema);

export const InventoryTransaction = mongoose.model(
  'InventoryTransaction',
  inventoryTransactionSchema
);
