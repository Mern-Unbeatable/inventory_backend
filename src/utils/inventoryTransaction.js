import { InventoryTransaction } from '../models/InventoryTransaction.js';

/**
 * Writes one immutable inventory-transaction ledger row.
 * Pass `{ session }` to include the write inside an active Mongo session/transaction.
 */
export const recordInventoryTransaction = async (
  { userProductId, userId, productId, type, beforeQuantity, changeQuantity, afterQuantity, reason, performedBy },
  { session } = {}
) =>
  InventoryTransaction.create(
    [
      {
        userProductId,
        userId,
        productId,
        type,
        beforeQuantity,
        changeQuantity,
        afterQuantity,
        reason: reason ?? null,
        performedBy,
      },
    ],
    { session }
  ).then(([doc]) => doc);
