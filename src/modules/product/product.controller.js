import productService from './product.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

const productController = {
  create: catchAsync(async (req, res) => {
    const data = await productService.create(
      req.body,
      req.uploadedFile,
      req.user
    );
    return ApiResponse.created(res, data, 'Product created successfully');
  }),

  list: catchAsync(async (req, res) => {
    const data = await productService.list(req.query, req.user);
    return ApiResponse.success(res, data, 'Products fetched successfully');
  }),

  getById: catchAsync(async (req, res) => {
    const data = await productService.getById(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Product fetched successfully');
  }),

  update: catchAsync(async (req, res) => {
    const data = await productService.update(
      req.params.id,
      req.body,
      req.uploadedFile,
      req.user
    );
    return ApiResponse.success(res, data, 'Product updated successfully');
  }),

  remove: catchAsync(async (req, res) => {
    const data = await productService.remove(req.params.id);
    return ApiResponse.success(res, data, 'Product deleted successfully');
  }),
};

export default productController;
