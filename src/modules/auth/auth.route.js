import { Router } from 'express';
import authController from './auth.controller.js';
import validate from '../../middlewares/validate.middleware.js';
import authenticate from '../../middlewares/auth.middleware.js';
import { loginSchema, refreshTokenSchema, logoutSchema } from './auth.validation.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/refresh', validate({ body: refreshTokenSchema }), authController.refresh);
router.post('/logout', validate({ body: logoutSchema }), authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
