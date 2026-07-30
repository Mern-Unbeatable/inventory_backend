import { Product } from '../../models/Product.js';
import { UserProduct } from '../../models/UserProduct.js';
import { toApi } from '../../utils/mongooseHelpers.js';
import ApiError from '../../utils/ApiError.js';
import customerRepository from '../customer/customer.repository.js';
import { getSellerIdsByCountry } from '../../utils/countryScope.js';

const getAvailableQuantities = async (productIds, sellerIds) => {
  if (!productIds.length) return new Map();
  const rows = await UserProduct.aggregate([
    {
      $match: {
        productId: { $in: productIds },
        ...(sellerIds?.length ? { userId: { $in: sellerIds } } : {}),
      },
    },
    { $group: { _id: '$productId', total: { $sum: '$quantity' } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.total]));
};

const productRequestService = {
  /**
   * Validates cart items against live catalog + stock, then returns PDF payload.
   * Does not modify inventory or create invoices.
   */
  async buildPdfPayload({ items }, requester) {
    const countryId = await customerRepository.findCountryIdByUserId(requester.id);
    if (!countryId) {
      throw ApiError.forbidden(
        'Your account is not linked to a customer profile with a country assignment'
      );
    }

    const sellerIds = await getSellerIdsByCountry(countryId);
    if (!sellerIds.length) {
      throw ApiError.badRequest('No product inventory is available for your country');
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((row) => [row._id, toApi(row)]));

    const assignedIds = await UserProduct.find({
      productId: { $in: productIds },
      userId: { $in: sellerIds },
    }).distinct('productId');
    const assignedSet = new Set(assignedIds.map(String));

    const stockMap = await getAvailableQuantities(productIds, sellerIds);

    const enriched = [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw ApiError.badRequest(`Product not found: ${item.productId}`);
      }

      if (!assignedSet.has(String(item.productId))) {
        throw ApiError.badRequest(
          `Product "${product.title}" is not available in your country`
        );
      }

      const availableQuantity = stockMap.get(item.productId) ?? 0;
      if (item.quantity > availableQuantity) {
        throw ApiError.badRequest(
          `Insufficient stock for "${product.title}". Available: ${availableQuantity}, requested: ${item.quantity}`
        );
      }

      const unitPrice = Number(product.price) || 0;
      const lineTotal = unitPrice * item.quantity;
      enriched.push({
        product,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });
    }

    const grandTotal = enriched.reduce((sum, row) => sum + row.lineTotal, 0);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    return {
      filename: `product-request-${stamp}.pdf`,
      customer: {
        name: requester.name,
        email: requester.email,
      },
      items: enriched,
      grandTotal,
    };
  },
};

export default productRequestService;
