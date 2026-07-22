import inventoryService from './inventory.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

const inventoryController = {
  assign: catchAsync(async (req, res) => {
    const data = await inventoryService.assign(req.body);
    return ApiResponse.created(res, data, 'Product assigned successfully');
  }),

  list: catchAsync(async (req, res) => {
    const data = await inventoryService.list(req.query);
    return ApiResponse.success(res, data, 'Inventory fetched successfully');
  }),

  myInventory: catchAsync(async (req, res) => {
    const data = await inventoryService.getMyInventory(req.user);
    return ApiResponse.success(res, data, 'My inventory fetched successfully');
  }),

  getUserInventory: catchAsync(async (req, res) => {
    const data = await inventoryService.getUserInventory(req.params.userId, req.user);
    return ApiResponse.success(res, data, 'User inventory fetched successfully');
  }),

  getById: catchAsync(async (req, res) => {
    const data = await inventoryService.getById(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Inventory record fetched successfully');
  }),

  updateQuantity: catchAsync(async (req, res) => {
    const data = await inventoryService.updateQuantity(
      req.params.id,
      req.body.quantity,
      req.user
    );
    return ApiResponse.success(res, data, 'Quantity updated successfully');
  }),

  adjustQuantity: catchAsync(async (req, res) => {
    const data = await inventoryService.adjustQuantity(
      req.params.id,
      req.body.delta,
      req.user
    );
    return ApiResponse.success(res, data, 'Quantity adjusted successfully');
  }),

  sell: catchAsync(async (req, res) => {
    const data = await inventoryService.sell(req.params.id, req.body.quantity, req.user);
    return ApiResponse.success(res, data, 'Sale recorded and stock updated');
  }),

  unassign: catchAsync(async (req, res) => {
    const data = await inventoryService.unassign(req.params.id);
    return ApiResponse.success(res, data, 'Product unassigned successfully');
  }),
};

export default inventoryController;
