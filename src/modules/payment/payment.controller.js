import paymentService from './payment.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

const paymentController = {
  create: catchAsync(async (req, res) => {
    const data = await paymentService.create(req.body, req.user);
    return ApiResponse.created(res, data, 'Payment recorded successfully');
  }),

  list: catchAsync(async (req, res) => {
    const data = await paymentService.list(req.query, req.user);
    return ApiResponse.success(res, data, 'Payments fetched successfully');
  }),

  getById: catchAsync(async (req, res) => {
    const data = await paymentService.getById(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Payment fetched successfully');
  }),

  remove: catchAsync(async (req, res) => {
    const data = await paymentService.remove(req.params.id);
    return ApiResponse.success(res, data, 'Payment reversed successfully');
  }),
};

export default paymentController;
