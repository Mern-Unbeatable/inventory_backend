import productRepository from './product.repository.js';
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

const productService = {
  async create(payload, uploadedFile) {
    const sku = payload.sku.trim().toUpperCase();
    const existing = await productRepository.findBySku(sku);
    if (existing) {
      throw ApiError.conflict('SKU already exists');
    }

    try {
      return await productRepository.create({
        title: payload.title.trim(),
        sku,
        description: payload.description ?? null,
        price: payload.price ?? 0,
        imageUrl: uploadedFile?.publicPath ?? null,
      });
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

    const { items, total } = await productRepository.findMany({
      filters: {
        search,
        minPrice,
        maxPrice,
      },
      skip,
      take: limit,
      sellerId: isSeller ? requester.id : null,
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

    const product = await productRepository.findById(id);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    return product;
  },

  async update(id, payload, uploadedFile) {
    const existing = await this.getById(id, { role: 'ADMIN' });

    if (payload.sku) {
      const sku = payload.sku.trim().toUpperCase();
      const skuOwner = await productRepository.findBySku(sku);
      if (skuOwner && skuOwner.id !== id) {
        throw ApiError.conflict('SKU already exists');
      }
      payload.sku = sku;
    }

    const data = {
      ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
      ...(payload.sku !== undefined ? { sku: payload.sku } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.price !== undefined ? { price: payload.price } : {}),
    };

    const removeImage = Boolean(payload.removeImage);
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
      const updated = await productRepository.update(id, data);
      if (previousImageUrl && previousImageUrl !== updated.imageUrl) {
        deleteStoredFile(previousImageUrl);
      }
      return updated;
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
