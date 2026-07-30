import customerService from './customer.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

const customerController = {
  create: catchAsync(async (req, res) => {
    const data = await customerService.create(req.body, req.user);
    return ApiResponse.created(res, data, 'Customer created successfully');
  }),

  list: catchAsync(async (req, res) => {
    const data = await customerService.list(req.query, req.user);
    return ApiResponse.success(res, data, 'Customers fetched successfully');
  }),

  getById: catchAsync(async (req, res) => {
    const data = await customerService.getById(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Customer fetched successfully');
  }),

  update: catchAsync(async (req, res) => {
    const data = await customerService.update(req.params.id, req.body, req.user);
    return ApiResponse.success(res, data, 'Customer updated successfully');
  }),

  remove: catchAsync(async (req, res) => {
    const data = await customerService.remove(req.params.id);
    return ApiResponse.success(res, data, 'Customer deleted successfully');
  }),

  getInvoices: catchAsync(async (req, res) => {
    const data = await customerService.getInvoices(req.params.id, req.query, req.user);
    return ApiResponse.success(res, data, "Customer's invoices fetched successfully");
  }),

  getPurchaseHistory: catchAsync(async (req, res) => {
    const data = await customerService.getPurchaseHistory(req.params.id, req.query, req.user);
    return ApiResponse.success(res, data, 'Purchase history fetched successfully');
  }),

  createPortalAccount: catchAsync(async (req, res) => {
    const data = await customerService.createPortalAccount(req.params.id, req.body);
    return ApiResponse.created(res, data, 'Portal account created successfully');
  }),
};

export default customerController;
