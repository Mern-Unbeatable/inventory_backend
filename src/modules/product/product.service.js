import productRepository from './product.repository.js';
import ApiError from '../../utils/ApiError.js';

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
  async create(payload) {
    const sku = payload.sku.trim().toUpperCase();
    const existing = await productRepository.findBySku(sku);
    if (existing) {
      throw ApiError.conflict('SKU already exists');
    }

    return productRepository.create({
      title: payload.title.trim(),
      sku,
      description: payload.description ?? null,
      price: payload.price ?? 0,
    });
  },

  async list(query, requester) {
    const { page, limit, search, minPrice, maxPrice } = query;
    const skip = (page - 1) * limit;
    const isSeller = requester?.role === 'SELLER';

    const where = {
      ...(isSeller
        ? {
            assignedUsers: {
              some: { userId: requester.id },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            price: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
            },
          }
        : {}),
    };

    const { items, total } = await productRepository.findMany({
      where,
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

  async update(id, payload) {
    await this.getById(id, { role: 'ADMIN' });

    if (payload.sku) {
      const sku = payload.sku.trim().toUpperCase();
      const existing = await productRepository.findBySku(sku);
      if (existing && existing.id !== id) {
        throw ApiError.conflict('SKU already exists');
      }
      payload.sku = sku;
    }

    return productRepository.update(id, {
      ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
      ...(payload.sku !== undefined ? { sku: payload.sku } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.price !== undefined ? { price: payload.price } : {}),
    });
  },

  async remove(id) {
    await this.getById(id, { role: 'ADMIN' });
    return productRepository.delete(id);
  },
};

export default productService;
