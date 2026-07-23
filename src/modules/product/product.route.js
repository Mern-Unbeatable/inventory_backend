import { Router } from 'express';
import productController from './product.controller.js';
import authenticate from '../../middlewares/auth.middleware.js';
import authorize from '../../middlewares/role.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import { uploadProductImage } from '../../middlewares/upload.middleware.js';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  listProductsQuerySchema,
} from './product.validation.js';

const router = Router();

router.use(authenticate);

// Admin: full master product CRUD (JSON or multipart/form-data with optional image)
router.post(
  '/',
  authorize('ADMIN'),
  uploadProductImage,
  validate({ body: createProductSchema }),
  productController.create
);

// Admin: full catalog. Seller: only products assigned by admin.
router.get(
  '/',
  authorize('ADMIN', 'SELLER'),
  validate({ query: listProductsQuerySchema }),
  productController.list
);

router.get(
  '/:id',
  authorize('ADMIN', 'SELLER'),
  validate({ params: productIdParamSchema }),
  productController.getById
);

router.patch(
  '/:id',
  authorize('ADMIN'),
  uploadProductImage,
  validate({ params: productIdParamSchema, body: updateProductSchema }),
  productController.update
);

router.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: productIdParamSchema }),
  productController.remove
);

export default router;
