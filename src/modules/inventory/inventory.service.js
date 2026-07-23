import inventoryRepository from './inventory.repository.js';
import ApiError from '../../utils/ApiError.js';

const inventoryService = {
  /**
   * Admin assigns a master product to a seller with an initial quantity.
   */
  async assign(payload) {
    const user = await inventoryRepository.userExists(payload.userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    if (user.role !== 'SELLER') {
      throw ApiError.badRequest('Products can only be assigned to sellers');
    }

    const product = await inventoryRepository.productExists(payload.productId);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    const existing = await inventoryRepository.findByUserAndProduct(
      payload.userId,
      payload.productId
    );
    if (existing) {
      throw ApiError.conflict(
        'Product already assigned to this user. Use quantity update instead.'
      );
    }

    return inventoryRepository.assign({
      userId: payload.userId,
      productId: payload.productId,
      quantity: payload.quantity ?? 0,
    });
  },

  /**
   * Cascading admin inventory list: Country -> Branch -> User filters.
   */
  async list(query) {
    const { page, limit, countryId, branchId, userId, productId, search } = query;
    const skip = (page - 1) * limit;

    const { items, total } = await inventoryRepository.findMany({
      filters: { countryId, branchId, userId, productId, search },
      skip,
      take: limit,
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  /**
   * Seller: own inventory. Admin: any user's inventory.
   */
  async getUserInventory(targetUserId, requester) {
    if (requester.role === 'SELLER' && requester.id !== targetUserId) {
      throw ApiError.forbidden('You can only view your own inventory');
    }

    const user = await inventoryRepository.userExists(targetUserId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const items = await inventoryRepository.findByUserId(targetUserId);
    const totalQuantity = items.reduce((sum, row) => sum + row.quantity, 0);

    return {
      user,
      items,
      summary: {
        productCount: items.length,
        totalQuantity,
      },
    };
  },

  /** Convenience: authenticated seller's own inventory */
  async getMyInventory(requester) {
    return this.getUserInventory(requester.id, requester);
  },

  async getById(id, requester) {
    const row = await inventoryRepository.findById(id);
    if (!row) {
      throw ApiError.notFound('Inventory record not found');
    }

    if (requester.role === 'SELLER' && row.userId !== requester.id) {
      throw ApiError.forbidden('You can only view your own inventory');
    }

    return row;
  },

  assertCanMutateStock(row, requester) {
    if (!row) {
      throw ApiError.notFound('Inventory record not found');
    }
    if (requester.role === 'SELLER' && row.userId !== requester.id) {
      throw ApiError.forbidden('You can only update your own stock');
    }
    return row;
  },

  /** Admin-only: set absolute remaining quantity */
  async updateQuantity(id, quantity, requester) {
    if (requester.role !== 'ADMIN') {
      throw ApiError.forbidden('Only admins can set stock quantity');
    }
    const row = this.assertCanMutateStock(await inventoryRepository.findById(id), requester);
    return inventoryRepository.updateQuantity(row.id, quantity);
  },

  /** Admin-only: increase/decrease by delta */
  async adjustQuantity(id, delta, requester) {
    if (requester.role !== 'ADMIN') {
      throw ApiError.forbidden('Only admins can adjust stock');
    }
    const row = this.assertCanMutateStock(await inventoryRepository.findById(id), requester);

    const next = row.quantity + delta;
    if (next < 0) {
      throw ApiError.badRequest(
        `Insufficient stock. Current quantity is ${row.quantity}`
      );
    }

    return inventoryRepository.updateQuantity(row.id, next);
  },

  /**
   * Record a sale: decrease stock + persist revenue (qty × catalog unit price).
   * Seller: own assignments only. Admin: any assignment.
   */
  async sell(id, soldQuantity, requester) {
    const row = this.assertCanMutateStock(await inventoryRepository.findById(id), requester);

    if (soldQuantity > row.quantity) {
      throw ApiError.badRequest(
        `Insufficient stock. Current quantity is ${row.quantity}`
      );
    }

    const unitPrice = row.product?.price ?? 0;

    try {
      const result = await inventoryRepository.recordSale({
        inventoryId: row.id,
        soldQuantity,
        unitPrice,
        userId: row.userId,
        productId: row.productId,
      });

      return {
        ...result.inventory,
        soldQuantity,
        previousQuantity: result.previousQuantity,
        unitPrice,
        revenue: result.sale.revenue,
        sale: result.sale,
      };
    } catch (error) {
      if (error?.message === 'INSUFFICIENT_STOCK') {
        throw ApiError.badRequest('Insufficient stock for this sale');
      }
      if (error?.message === 'NOT_FOUND') {
        throw ApiError.notFound('Inventory record not found');
      }
      throw error;
    }
  },

  /** Admin-only: unassign product from user */
  async unassign(id) {
    const row = await inventoryRepository.findById(id);
    if (!row) {
      throw ApiError.notFound('Inventory record not found');
    }

    return inventoryRepository.delete(id);
  },
};

export default inventoryService;
