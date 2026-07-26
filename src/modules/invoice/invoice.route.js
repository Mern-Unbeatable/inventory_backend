import { Router } from 'express';
import invoiceController from './invoice.controller.js';
import authenticate from '../../middlewares/auth.middleware.js';
import authorize from '../../middlewares/role.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceIdParamSchema,
  listInvoicesQuerySchema,
} from './invoice.validation.js';

const router = Router();

router.use(authenticate);

// Admin or Seller: create a DRAFT invoice (no stock impact yet)
router.post(
  '/',
  authorize('ADMIN', 'SELLER'),
  validate({ body: createInvoiceSchema }),
  invoiceController.create
);

// Admin: all invoices. Seller: only their own.
router.get(
  '/',
  authorize('ADMIN', 'SELLER'),
  validate({ query: listInvoicesQuerySchema }),
  invoiceController.list
);

// PDF download — registered before bare /:id for clarity; ownership in service
router.get(
  '/:id/pdf',
  authorize('ADMIN', 'SELLER'),
  validate({ params: invoiceIdParamSchema }),
  invoiceController.downloadPdf
);

router.get(
  '/:id',
  authorize('ADMIN', 'SELLER'),
  validate({ params: invoiceIdParamSchema }),
  invoiceController.getById
);

// Draft-only edit (items/notes)
router.patch(
  '/:id',
  authorize('ADMIN', 'SELLER'),
  validate({ params: invoiceIdParamSchema, body: updateInvoiceSchema }),
  invoiceController.update
);

// Transactionally deducts inventory and locks the invoice
router.post(
  '/:id/confirm',
  authorize('ADMIN', 'SELLER'),
  validate({ params: invoiceIdParamSchema }),
  invoiceController.confirm
);

// Draft-only cancel (no stock impact to roll back)
router.post(
  '/:id/cancel',
  authorize('ADMIN', 'SELLER'),
  validate({ params: invoiceIdParamSchema }),
  invoiceController.cancel
);

// Admin only: hard delete, draft-only
router.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: invoiceIdParamSchema }),
  invoiceController.remove
);

export default router;
