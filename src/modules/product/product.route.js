import { Router } from 'express';
import productController from './product.controller.js';
import authenticate from '../../middlewares/auth.middleware.js';
import authorize from '../../middlewares/role.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  uploadProductImage,
  uploadProductSpreadsheet,
} from '../../middlewares/upload.middleware.js';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  listProductsQuerySchema,
  exportProductsQuerySchema,
} from './product.validation.js';

const router = Router();

router.use(authenticate);

// Admin + Seller: create product (seller owns + auto-assigns to their inventory)
router.post(
  '/',
  authorize('ADMIN', 'SELLER'),
  uploadProductImage,
  validate({ body: createProductSchema }),
  productController.create
);

// Export / import must be registered before `/:id`
router.get(
  '/export',
  authorize('ADMIN', 'SELLER'),
  validate({ query: exportProductsQuerySchema }),
  productController.exportProducts
);

router.post(
  '/import',
  authorize('ADMIN', 'SELLER'),
  uploadProductSpreadsheet,
  productController.importProducts
);

// Admin: full catalog. Seller: only products assigned by admin / self-created.
// Customer: read-only catalog (title/price/availableQuantity only).
router.get(
  '/',
  authorize('ADMIN', 'SELLER', 'CUSTOMER'),
  validate({ query: listProductsQuerySchema }),
  productController.list
);

router.get(
  '/:id',
  authorize('ADMIN', 'SELLER', 'CUSTOMER'),
  validate({ params: productIdParamSchema }),
  productController.getById
);

// Admin: any product. Seller: only products they own (enforced in service).
router.patch(
  '/:id',
  authorize('ADMIN', 'SELLER'),
  uploadProductImage,
  validate({ params: productIdParamSchema, body: updateProductSchema }),
  productController.update
);

// Admin only — sellers cannot delete products
router.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: productIdParamSchema }),
  productController.remove
);

export default router;
