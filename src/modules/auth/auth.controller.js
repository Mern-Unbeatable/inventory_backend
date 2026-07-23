import authService from './auth.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

const authController = {
  login: catchAsync(async (req, res) => {
    const data = await authService.login(req.body);
    return ApiResponse.success(res, data, 'Login successful');
  }),

  refresh: catchAsync(async (req, res) => {
    const data = await authService.refresh(req.body.refreshToken);
    return ApiResponse.success(res, data, 'Token refreshed successfully');
  }),

  logout: catchAsync(async (req, res) => {
    const data = await authService.logout(req.body.refreshToken);
    return ApiResponse.success(res, data, 'Logged out successfully');
  }),

  me: catchAsync(async (req, res) => {
    const data = await authService.me(req.user.id);
    return ApiResponse.success(res, data, 'Profile fetched successfully');
  }),

  updateProfile: catchAsync(async (req, res) => {
    const data = await authService.updateProfile(req.user.id, req.body);
    return ApiResponse.success(res, data, 'Profile updated successfully');
  }),

  changePassword: catchAsync(async (req, res) => {
    const data = await authService.changePassword(req.user.id, req.body);
    return ApiResponse.success(res, data, 'Password updated successfully');
  }),
};

export default authController;
