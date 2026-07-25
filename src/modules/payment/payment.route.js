import { Router } from 'express';
import paymentController from './payment.controller.js';
import authenticate from '../../middlewares/auth.middleware.js';
import authorize from '../../middlewares/role.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createPaymentSchema,
  paymentIdParamSchema,
  listPaymentsQuerySchema,
} from './payment.validation.js';

const router = Router();

router.use(authenticate);

// Admin or Seller (own invoice): record a full/partial/installment payment
router.post(
  '/',
  authorize('ADMIN', 'SELLER'),
  validate({ body: createPaymentSchema }),
  paymentController.create
);

// Admin: all payments. Seller: only payments on their own invoices.
router.get(
  '/',
  authorize('ADMIN', 'SELLER'),
  validate({ query: listPaymentsQuerySchema }),
  paymentController.list
);

router.get(
  '/:id',
  authorize('ADMIN', 'SELLER'),
  validate({ params: paymentIdParamSchema }),
  paymentController.getById
);

// Admin only: reverses a payment and recomputes the invoice
router.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: paymentIdParamSchema }),
  paymentController.remove
);

export default router;
