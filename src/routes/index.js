import { Router } from "express";
import authRoutes from "../modules/auth/auth.route.js";
import userRoutes from "../modules/user/user.route.js";
import branchRoutes, { countryRoutes } from "../modules/branch/branch.route.js";
import productRoutes from "../modules/product/product.route.js";
import inventoryRoutes from "../modules/inventory/inventory.route.js";
import dashboardRoutes from "../modules/dashboard/dashboard.route.js";
import customerRoutes from "../modules/customer/customer.route.js";
import invoiceRoutes from "../modules/invoice/invoice.route.js";
import paymentRoutes from "../modules/payment/payment.route.js";
import productRequestRoutes from "../modules/product-request/product-request.route.js";
import verificationRoutes, {
  publicVerificationRoutes,
} from "../modules/verification/verification.route.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/countries", countryRoutes);
router.use("/branches", branchRoutes);
router.use("/products", productRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/customers", customerRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/payments", paymentRoutes);
router.use("/product-requests", productRequestRoutes);
router.use("/verifications", verificationRoutes);
router.use("/verify", publicVerificationRoutes);

export default router;
