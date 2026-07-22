import { Router } from 'express';
import dashboardController from './dashboard.controller.js';
import authenticate from '../../middlewares/auth.middleware.js';
import authorize from '../../middlewares/role.middleware.js';

const router = Router();

router.get(
  '/overview',
  authenticate,
  authorize('ADMIN', 'SELLER'),
  dashboardController.overview
);

export default router;
