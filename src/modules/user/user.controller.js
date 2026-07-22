import userService from './user.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

const userController = {
  create: catchAsync(async (req, res) => {
    const data = await userService.create(req.body);
    return ApiResponse.created(res, data, 'User created successfully');
  }),

  list: catchAsync(async (req, res) => {
    const data = await userService.list(req.query);
    return ApiResponse.success(res, data, 'Users fetched successfully');
  }),

  getById: catchAsync(async (req, res) => {
    const data = await userService.getById(req.params.id, req.user);
    return ApiResponse.success(res, data, 'User fetched successfully');
  }),

  update: catchAsync(async (req, res) => {
    const data = await userService.update(req.params.id, req.body);
    return ApiResponse.success(res, data, 'User updated successfully');
  }),

  remove: catchAsync(async (req, res) => {
    const data = await userService.remove(req.params.id, req.user.id);
    return ApiResponse.success(res, data, 'User deleted successfully');
  }),
};

export default userController;
