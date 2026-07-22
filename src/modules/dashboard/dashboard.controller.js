import dashboardService from './dashboard.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

const dashboardController = {
  overview: catchAsync(async (req, res) => {
    const data = await dashboardService.getOverview(req.user);
    return ApiResponse.success(res, data, 'Dashboard overview fetched successfully');
  }),
};

export default dashboardController;
