import { Router } from 'express';
import customerController from './customer.controller.js';
import authenticate from '../../middlewares/auth.middleware.js';
import authorize from '../../middlewares/role.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  createPortalAccountSchema,
  updatePortalPasswordSchema,
  customerIdParamSchema,
  listCustomersQuerySchema,
  listCustomerInvoicesQuerySchema,
} from './customer.validation.js';

const router = Router();

router.use(authenticate);

// Admin or Seller: create a customer record (CRM contact used for invoicing)
router.post(
  '/',
  authorize('ADMIN', 'SELLER'),
  validate({ body: createCustomerSchema }),
  customerController.create
);

router.get(
  '/',
  authorize('ADMIN', 'SELLER'),
  validate({ query: listCustomersQuerySchema }),
  customerController.list
);

router.get(
  '/:id',
  authorize('ADMIN', 'SELLER'),
  validate({ params: customerIdParamSchema }),
  customerController.getById
);

router.patch(
  '/:id',
  authorize('ADMIN', 'SELLER'),
  validate({ params: customerIdParamSchema, body: updateCustomerSchema }),
  customerController.update
);

// Admin only: delete (blocked if the customer has existing invoices)
router.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: customerIdParamSchema }),
  customerController.remove
);

router.get(
  '/:id/invoices',
  authorize('ADMIN', 'SELLER'),
  validate({ params: customerIdParamSchema, query: listCustomerInvoicesQuerySchema }),
  customerController.getInvoices
);

router.get(
  '/:id/purchase-history',
  authorize('ADMIN', 'SELLER'),
  validate({ params: customerIdParamSchema, query: listCustomersQuerySchema.pick({ page: true, limit: true }) }),
  customerController.getPurchaseHistory
);

// Admin only: create/link a CUSTOMER-role portal login for this customer
router.post(
  '/:id/portal-account',
  authorize('ADMIN'),
  validate({ params: customerIdParamSchema, body: createPortalAccountSchema }),
  customerController.createPortalAccount
);

// Admin only: reset password on an existing portal login
router.patch(
  '/:id/portal-account/password',
  authorize('ADMIN'),
  validate({ params: customerIdParamSchema, body: updatePortalPasswordSchema }),
  customerController.updatePortalPassword
);

export default router;
