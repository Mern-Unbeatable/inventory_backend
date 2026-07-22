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
  inventoryIdParamSchema,
  userIdParamSchema,
  listInventoryQuerySchema,
} from './inventory.validation.js';

const router = Router();

router.use(authenticate);

// Seller + Admin: own inventory shortcut
router.get('/me', authorize('ADMIN', 'SELLER'), inventoryController.myInventory);

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

// Admin: unassign
router.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: inventoryIdParamSchema }),
  inventoryController.unassign
);

export default router;
