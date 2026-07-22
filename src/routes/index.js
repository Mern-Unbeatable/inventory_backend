import { Router } from 'express';
import authRoutes from '../modules/auth/auth.route.js';
import userRoutes from '../modules/user/user.route.js';
import branchRoutes, { countryRoutes } from '../modules/branch/branch.route.js';
import productRoutes from '../modules/product/product.route.js';
import inventoryRoutes from '../modules/inventory/inventory.route.js';
import dashboardRoutes from '../modules/dashboard/dashboard.route.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/countries', countryRoutes);
router.use('/branches', branchRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
