import { Router } from 'express';
import inventoryController from './inventory.controller.js';
import authenticate from '../../middlewares/auth.middleware.js';
import authorize from '../../middlewares/role.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  assignProductSchema,
  updateQuantitySchema,
  adjustQuantitySchema,
  sellProductSchema,
  receiveStockSchema,
  inventoryIdParamSchema,
  userIdParamSchema,
  listInventoryQuerySchema,
  listTransactionsQuerySchema,
} from './inventory.validation.js';

const router = Router();

router.use(authenticate);

// Seller + Admin: own inventory shortcut
router.get('/me', authorize('ADMIN', 'SELLER'), inventoryController.myInventory);

// Seller: own full transaction history across all products.
// (Registered before the generic '/:id' route below — 'transactions' would
// otherwise be swallowed as an :id path segment.)
router.get(
  '/transactions/me',
  authorize('ADMIN', 'SELLER'),
  validate({ query: listTransactionsQuerySchema }),
  inventoryController.getMyTransactions
);

// Admin: global, filterable inventory transaction ledger
router.get(
  '/transactions',
  authorize('ADMIN'),
  validate({ query: listTransactionsQuerySchema }),
  inventoryController.listTransactions
);

// Admin: cascading inventory list (country / branch / user filters)
router.get(
  '/',
  authorize('ADMIN'),
  validate({ query: listInventoryQuerySchema }),
  inventoryController.list
);

// Admin: assign product to seller
router.post(
  '/assign',
  authorize('ADMIN'),
  validate({ body: assignProductSchema }),
  inventoryController.assign
);

// Admin or Seller (own): view a user's inventory
router.get(
  '/user/:userId',
  authorize('ADMIN', 'SELLER'),
  validate({ params: userIdParamSchema }),
  inventoryController.getUserInventory
);

// Single inventory record
router.get(
  '/:id',
  authorize('ADMIN', 'SELLER'),
  validate({ params: inventoryIdParamSchema }),
  inventoryController.getById
);

// Admin only: set absolute remaining quantity
router.patch(
  '/:id/quantity',
  authorize('ADMIN'),
  validate({ params: inventoryIdParamSchema, body: updateQuantitySchema }),
  inventoryController.updateQuantity
);

// Admin only: adjust by delta (+/-)
router.patch(
  '/:id/adjust',
  authorize('ADMIN'),
  validate({ params: inventoryIdParamSchema, body: adjustQuantitySchema }),
  inventoryController.adjustQuantity
);

// Admin or owning seller: record a sale (decreases stock)
router.post(
  '/:id/sell',
  authorize('ADMIN', 'SELLER'),
  validate({ params: inventoryIdParamSchema, body: sellProductSchema }),
  inventoryController.sell
);

// Admin or owning seller: record newly received stock (increases stock)
router.post(
  '/:id/receive',
  authorize('ADMIN', 'SELLER'),
  validate({ params: inventoryIdParamSchema, body: receiveStockSchema }),
  inventoryController.receive
);

// Admin or owning seller: transaction history for this inventory record
router.get(
  '/:id/transactions',
  authorize('ADMIN', 'SELLER'),
  validate({ params: inventoryIdParamSchema, query: listTransactionsQuerySchema }),
  inventoryController.getTransactions
);

// Admin: unassign
router.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: inventoryIdParamSchema }),
  inventoryController.unassign
);

export default router;
