import { Router } from 'express';
import branchController from './branch.controller.js';
import authenticate from '../../middlewares/auth.middleware.js';
import authorize from '../../middlewares/role.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createCountrySchema,
  updateCountrySchema,
  countryIdParamSchema,
  createBranchSchema,
  updateBranchSchema,
  branchIdParamSchema,
  listBranchesQuerySchema,
} from './branch.validation.js';

/** Country routes — mounted at /api/countries */
export const countryRoutes = Router();

countryRoutes.use(authenticate);

countryRoutes.get(
  '/',
  authorize('ADMIN', 'SELLER'),
  branchController.listCountries
);
countryRoutes.get(
  '/:id',
  authorize('ADMIN', 'SELLER'),
  validate({ params: countryIdParamSchema }),
  branchController.getCountry
);

countryRoutes.post(
  '/',
  authorize('ADMIN'),
  validate({ body: createCountrySchema }),
  branchController.createCountry
);
countryRoutes.patch(
  '/:id',
  authorize('ADMIN'),
  validate({ params: countryIdParamSchema, body: updateCountrySchema }),
  branchController.updateCountry
);
countryRoutes.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: countryIdParamSchema }),
  branchController.deleteCountry
);

/** Branch routes — mounted at /api/branches */
const branchRoutes = Router();

branchRoutes.use(authenticate);

branchRoutes.get(
  '/',
  authorize('ADMIN', 'SELLER'),
  validate({ query: listBranchesQuerySchema }),
  branchController.list
);
branchRoutes.get(
  '/:id',
  authorize('ADMIN', 'SELLER'),
  validate({ params: branchIdParamSchema }),
  branchController.getById
);

branchRoutes.post(
  '/',
  authorize('ADMIN'),
  validate({ body: createBranchSchema }),
  branchController.create
);
branchRoutes.patch(
  '/:id',
  authorize('ADMIN'),
  validate({ params: branchIdParamSchema, body: updateBranchSchema }),
  branchController.update
);
branchRoutes.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: branchIdParamSchema }),
  branchController.remove
);

export default branchRoutes;
