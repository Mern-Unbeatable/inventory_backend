import productRepository from './product.repository.js';
import inventoryRepository from '../inventory/inventory.repository.js';
import ApiError from '../../utils/ApiError.js';
import { deleteStoredFile } from '../../utils/fileStorage.js';

const mapSellerProduct = (product) => {
  if (!product) return null;
  const assignment = product.assignedUsers?.[0];
  const { assignedUsers, ...rest } = product;
  return {
    ...rest,
    quantity: assignment?.quantity ?? 0,
    assignmentId: assignment?.id ?? null,
    assignedAt: assignment?.updatedAt ?? null,
  };
};

/** Never accept ownership changes from the client body. */
const stripOwnershipFields = (payload = {}) => {
  const { ownerId: _ownerId, owner: _owner, ...safe } = payload;
  return safe;
};

const productService = {
  async create(payload, uploadedFile, requester) {
    const safePayload = stripOwnershipFields(payload);
    const sku = safePayload.sku.trim().toUpperCase();
    const existing = await productRepository.findBySku(sku);
    if (existing) {
      throw ApiError.conflict('SKU already exists');
    }

    const isSeller = requester?.role === 'SELLER';
    const ownerId = isSeller ? requester.id : null;

    try {
      const product = await productRepository.create({
        title: safePayload.title.trim(),
        sku,
        description: safePayload.description ?? null,
        price: safePayload.price ?? 0,
        imageUrl: uploadedFile?.publicPath ?? null,
        ownerId,
      });

      // Seller-created products must appear in their inventory list immediately.
      if (isSeller) {
        await inventoryRepository.assign({
          userId: requester.id,
          productId: product.id,
          quantity: 0,
        });
        return mapSellerProduct(
          await productRepository.findByIdForSeller(product.id, requester.id)
        );
      }

      return product;
    } catch (error) {
      if (uploadedFile?.publicPath) {
        deleteStoredFile(uploadedFile.publicPath);
      }
      throw error;
    }
  },

  async list(query, requester) {
    const { page, limit, search, minPrice, maxPrice } = query;
    const skip = (page - 1) * limit;
    const isSeller = requester?.role === 'SELLER';
    const isCustomer = requester?.role === 'CUSTOMER';

    const { items, total } = await productRepository.findMany({
      filters: {
        search,
        minPrice,
        maxPrice,
      },
      skip,
      take: limit,
      sellerId: isSeller ? requester.id : null,
      forCustomer: isCustomer,
    });

    return {
      items: isSeller ? items.map(mapSellerProduct) : items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async getById(id, requester) {
    if (requester?.role === 'SELLER') {
      const product = await productRepository.findByIdForSeller(id, requester.id);
      if (!product) {
        throw ApiError.notFound('Product not found or not assigned to you');
      }
      return mapSellerProduct(product);
    }

    if (requester?.role === 'CUSTOMER') {
      const product = await productRepository.findByIdForCustomer(id);
      if (!product) {
        throw ApiError.notFound('Product not found');
      }
      return product;
    }

    const product = await productRepository.findById(id);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    return product;
  },

  async update(id, payload, uploadedFile, requester) {
    const safePayload = stripOwnershipFields(payload);
    const isSeller = requester?.role === 'SELLER';

    let existing;
    if (isSeller) {
      existing = await productRepository.findById(id);
      if (!existing) {
        throw ApiError.notFound('Product not found');
      }
      if (!existing.ownerId || existing.ownerId !== requester.id) {
        throw ApiError.forbidden(
          'You can only update products you own. Catalog products cannot be edited by sellers.'
        );
      }
      // Seller must still be assigned (their own create auto-assigns; keep consistent).
      const assigned = await productRepository.findByIdForSeller(id, requester.id);
      if (!assigned) {
        throw ApiError.forbidden('Product is not available in your inventory');
      }
    } else {
      existing = await this.getById(id, { role: 'ADMIN' });
    }

    if (safePayload.sku) {
      const sku = safePayload.sku.trim().toUpperCase();
      const skuOwner = await productRepository.findBySku(sku);
      if (skuOwner && skuOwner.id !== id) {
        throw ApiError.conflict('SKU already exists');
      }
      safePayload.sku = sku;
    }

    const data = {
      ...(safePayload.title !== undefined
        ? { title: safePayload.title.trim() }
        : {}),
      ...(safePayload.sku !== undefined ? { sku: safePayload.sku } : {}),
      ...(safePayload.description !== undefined
        ? { description: safePayload.description }
        : {}),
      ...(safePayload.price !== undefined ? { price: safePayload.price } : {}),
    };

    const removeImage = Boolean(safePayload.removeImage);
    let previousImageUrl = null;

    if (uploadedFile?.publicPath) {
      previousImageUrl = existing.imageUrl;
      data.imageUrl = uploadedFile.publicPath;
    } else if (removeImage && existing.imageUrl) {
      previousImageUrl = existing.imageUrl;
      data.imageUrl = null;
    }

    if (Object.keys(data).length === 0 && !uploadedFile && !removeImage) {
      throw ApiError.badRequest('At least one field is required');
    }

    try {
      await productRepository.update(id, data);
      if (previousImageUrl) {
        const updatedCheck = await productRepository.findById(id);
        if (previousImageUrl !== updatedCheck?.imageUrl) {
          deleteStoredFile(previousImageUrl);
        }
      }

      if (isSeller) {
        return mapSellerProduct(
          await productRepository.findByIdForSeller(id, requester.id)
        );
      }
      return productRepository.findById(id);
    } catch (error) {
      if (uploadedFile?.publicPath) {
        deleteStoredFile(uploadedFile.publicPath);
      }
      throw error;
    }
  },

  async remove(id) {
    await this.getById(id, { role: 'ADMIN' });
    return productRepository.delete(id);
  },
};

export default productService;
