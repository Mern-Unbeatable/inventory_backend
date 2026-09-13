import { Router } from "express";
import verificationController from "./verification.controller.js";
import authenticate from "../../middlewares/auth.middleware.js";
import authorize from "../../middlewares/role.middleware.js";
import validate from "../../middlewares/validate.middleware.js";
import {
  bulkVerificationDeleteSchema,
  createVerificationSchema,
  updateVerificationSchema,
  verificationIdParamSchema,
  qrIdParamSchema,
  verifyQuerySchema,
  listVerificationsQuerySchema,
} from "./verification.validation.js";

/** Public router — mounted at /api/verify. No authentication required. */
export const publicVerificationRoutes = Router();

publicVerificationRoutes.get(
  "/:qrId",
  validate({ params: qrIdParamSchema, query: verifyQuerySchema }),
  verificationController.verify,
);

/** Admin + Seller router — mounted at /api/verifications. */
const router = Router();

router.use(authenticate);
router.use(authorize("ADMIN", "SELLER"));

router.post(
  "/",
  validate({ body: createVerificationSchema }),
  verificationController.create,
);

router.get(
  "/",
  validate({ query: listVerificationsQuerySchema }),
  verificationController.list,
);

router.get(
  "/:id",
  validate({ params: verificationIdParamSchema }),
  verificationController.getById,
);

router.patch(
  "/:id",
  validate({
    params: verificationIdParamSchema,
    body: updateVerificationSchema,
  }),
  verificationController.update,
);

router.delete(
  "/bulk",
  validate({ body: bulkVerificationDeleteSchema }),
  verificationController.bulkRemove,
);

router.delete(
  "/:id",
  validate({ params: verificationIdParamSchema }),
  verificationController.remove,
);

export default router;
