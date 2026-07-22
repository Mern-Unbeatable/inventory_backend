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

countryRoutes.use(authenticate, authorize('ADMIN'));

countryRoutes.post('/', validate({ body: createCountrySchema }), branchController.createCountry);
countryRoutes.get('/', branchController.listCountries);
countryRoutes.get(
  '/:id',
  validate({ params: countryIdParamSchema }),
  branchController.getCountry
);
countryRoutes.patch(
  '/:id',
  validate({ params: countryIdParamSchema, body: updateCountrySchema }),
  branchController.updateCountry
);
countryRoutes.delete(
  '/:id',
  validate({ params: countryIdParamSchema }),
  branchController.deleteCountry
);

/** Branch routes — mounted at /api/branches */
const branchRoutes = Router();

branchRoutes.use(authenticate, authorize('ADMIN'));

branchRoutes.post('/', validate({ body: createBranchSchema }), branchController.create);
branchRoutes.get(
  '/',
  validate({ query: listBranchesQuerySchema }),
  branchController.list
);
branchRoutes.get(
  '/:id',
  validate({ params: branchIdParamSchema }),
  branchController.getById
);
branchRoutes.patch(
  '/:id',
  validate({ params: branchIdParamSchema, body: updateBranchSchema }),
  branchController.update
);
branchRoutes.delete(
  '/:id',
  validate({ params: branchIdParamSchema }),
  branchController.remove
);

export default branchRoutes;
