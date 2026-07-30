import { Router } from 'express';
import productRequestController from './product-request.controller.js';
import authenticate from '../../middlewares/auth.middleware.js';
import authorize from '../../middlewares/role.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import { generateProductRequestPdfSchema } from './product-request.validation.js';

const router = Router();

router.use(authenticate);

// Customer-only: generate a product request PDF from cart items (no stock deduction).
router.post(
  '/pdf',
  authorize('CUSTOMER'),
  validate({ body: generateProductRequestPdfSchema }),
  productRequestController.downloadPdf
);

export default router;
