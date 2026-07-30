import productRequestService from './product-request.service.js';
import { buildProductRequestPdf } from './product-requestPdf.builder.js';
import catchAsync from '../../utils/catchAsync.js';

const productRequestController = {
  downloadPdf: catchAsync(async (req, res) => {
    const { filename, customer, items, grandTotal } =
      await productRequestService.buildPdfPayload(req.body, req.user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    await buildProductRequestPdf({
      customer,
      items,
      grandTotal,
      generatedBy: req.user.name || req.user.email,
      outputStream: res,
    });
  }),
};

export default productRequestController;
