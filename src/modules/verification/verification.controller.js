import verificationService from "./verification.service.js";
import ApiResponse from "../../utils/ApiResponse.js";
import catchAsync from "../../utils/catchAsync.js";

const verificationController = {
  // ---- Admin ----
  create: catchAsync(async (req, res) => {
    const data = await verificationService.create(req.body);
    return ApiResponse.created(res, data, "Verification created successfully");
  }),

  list: catchAsync(async (req, res) => {
    const data = await verificationService.list(req.query);
    return ApiResponse.success(res, data, "Verifications fetched successfully");
  }),

  getById: catchAsync(async (req, res) => {
    const data = await verificationService.getById(req.params.id);
    return ApiResponse.success(res, data, "Verification fetched successfully");
  }),

  update: catchAsync(async (req, res) => {
    const data = await verificationService.update(req.params.id, req.body);
    return ApiResponse.success(res, data, "Verification updated successfully");
  }),

  remove: catchAsync(async (req, res) => {
    const data = await verificationService.remove(req.params.id);
    return ApiResponse.success(res, data, "Verification deleted successfully");
  }),

  bulkRemove: catchAsync(async (req, res) => {
    const data = await verificationService.bulkRemove(req.body.ids);
    return ApiResponse.success(
      res,
      data,
      `${data.deletedCount} verification${data.deletedCount === 1 ? "" : "s"} deleted successfully`,
    );
  }),

  // ---- Public ----
  verify: catchAsync(async (req, res) => {
    const data = await verificationService.verifyByQrId(req.params.qrId);
    return ApiResponse.success(res, data, "Product verified successfully");
  }),
};

export default verificationController;
