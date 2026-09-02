import { Router } from "express";
import userController from "./user.controller.js";
import authenticate from "../../middlewares/auth.middleware.js";
import authorize from "../../middlewares/role.middleware.js";
import validate from "../../middlewares/validate.middleware.js";
import {
  bulkUserDeleteSchema,
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  listUsersQuerySchema,
} from "./user.validation.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  authorize("ADMIN"),
  validate({ body: createUserSchema }),
  userController.create,
);

router.get(
  "/",
  authorize("ADMIN"),
  validate({ query: listUsersQuerySchema }),
  userController.list,
);

router.get(
  "/:id",
  validate({ params: userIdParamSchema }),
  userController.getById,
);

router.patch(
  "/:id",
  authorize("ADMIN"),
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  userController.update,
);

router.delete(
  "/bulk",
  authorize("ADMIN"),
  validate({ body: bulkUserDeleteSchema }),
  userController.bulkRemove,
);

router.delete(
  "/:id",
  authorize("ADMIN"),
  validate({ params: userIdParamSchema }),
  userController.remove,
);

export default router;
