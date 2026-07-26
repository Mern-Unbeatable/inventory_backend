import invoiceService from './invoice.service.js';
import { buildInvoicePdf } from './invoicePdf.builder.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

const invoiceController = {
  create: catchAsync(async (req, res) => {
    const data = await invoiceService.create(req.body, req.user);
    return ApiResponse.created(res, data, 'Invoice created as draft');
  }),

  list: catchAsync(async (req, res) => {
    const data = await invoiceService.list(req.query, req.user);
    return ApiResponse.success(res, data, 'Invoices fetched successfully');
  }),

  getById: catchAsync(async (req, res) => {
    const data = await invoiceService.getById(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Invoice fetched successfully');
  }),

  update: catchAsync(async (req, res) => {
    const data = await invoiceService.update(req.params.id, req.body, req.user);
    return ApiResponse.success(res, data, 'Invoice updated successfully');
  }),

  confirm: catchAsync(async (req, res) => {
    const data = await invoiceService.confirm(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Invoice confirmed and stock updated');
  }),

  cancel: catchAsync(async (req, res) => {
    const data = await invoiceService.cancel(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Invoice cancelled');
  }),

  remove: catchAsync(async (req, res) => {
    const data = await invoiceService.remove(req.params.id, req.user);
    return ApiResponse.success(res, data, 'Invoice deleted successfully');
  }),

  /**
   * Streams a generated PDF. Ownership is enforced in the service before
   * any bytes are written so forbidden requests never return a partial file.
   */
  downloadPdf: catchAsync(async (req, res) => {
    const { filename, invoice, customer, seller, payments } =
      await invoiceService.getPdfPayload(req.params.id, req.user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    await buildInvoicePdf({
      invoice,
      customer,
      seller,
      payments,
      generatedBy: req.user.name || req.user.email,
      outputStream: res,
    });
  }),
};

export default invoiceController;
