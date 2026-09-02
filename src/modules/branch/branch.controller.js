import branchService from "./branch.service.js";
import ApiResponse from "../../utils/ApiResponse.js";
import catchAsync from "../../utils/catchAsync.js";

const branchController = {
  // ---- Country ----
  createCountry: catchAsync(async (req, res) => {
    const data = await branchService.createCountry(req.body);
    return ApiResponse.created(res, data, "Country created successfully");
  }),

  listCountries: catchAsync(async (req, res) => {
    const data = await branchService.listCountries(req.user);
    return ApiResponse.success(res, data, "Countries fetched successfully");
  }),

  getCountry: catchAsync(async (req, res) => {
    const data = await branchService.getCountry(req.params.id, req.user);
    return ApiResponse.success(res, data, "Country fetched successfully");
  }),

  updateCountry: catchAsync(async (req, res) => {
    const data = await branchService.updateCountry(req.params.id, req.body);
    return ApiResponse.success(res, data, "Country updated successfully");
  }),

  deleteCountry: catchAsync(async (req, res) => {
    const data = await branchService.deleteCountry(req.params.id);
    return ApiResponse.success(res, data, "Country deleted successfully");
  }),

  bulkRemoveCountry: catchAsync(async (req, res) => {
    const data = await branchService.bulkDeleteCountries(req.body.ids);
    return ApiResponse.success(
      res,
      data,
      `${data.deletedCount} ${data.deletedCount === 1 ? "country" : "countries"} deleted successfully`,
    );
  }),

  // ---- Branch ----
  create: catchAsync(async (req, res) => {
    const data = await branchService.createBranch(req.body);
    return ApiResponse.created(res, data, "Branch created successfully");
  }),

  list: catchAsync(async (req, res) => {
    const data = await branchService.listBranches(req.query, req.user);
    return ApiResponse.success(res, data, "Branches fetched successfully");
  }),

  getById: catchAsync(async (req, res) => {
    const data = await branchService.getBranch(req.params.id, req.user);
    return ApiResponse.success(res, data, "Branch fetched successfully");
  }),

  update: catchAsync(async (req, res) => {
    const data = await branchService.updateBranch(req.params.id, req.body);
    return ApiResponse.success(res, data, "Branch updated successfully");
  }),

  remove: catchAsync(async (req, res) => {
    const data = await branchService.deleteBranch(req.params.id);
    return ApiResponse.success(res, data, "Branch deleted successfully");
  }),

  bulkRemove: catchAsync(async (req, res) => {
    const data = await branchService.bulkDeleteBranches(req.body.ids);
    return ApiResponse.success(
      res,
      data,
      `${data.deletedCount} branch${data.deletedCount === 1 ? "" : "s"} deleted successfully`,
    );
  }),
};

export default branchController;
