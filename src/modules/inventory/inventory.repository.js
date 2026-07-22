import prisma from '../../config/prisma.js';

const inventoryInclude = {
  product: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      branchId: true,
      branch: {
        include: { country: true },
      },
    },
  },
};

const inventoryRepository = {
  assign({ userId, productId, quantity }) {
    return prisma.userProduct.create({
      data: { userId, productId, quantity },
      include: inventoryInclude,
    });
  },

  upsertAssign({ userId, productId, quantity }) {
    return prisma.userProduct.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, quantity },
      update: { quantity },
      include: inventoryInclude,
    });
  },

  findById(id) {
    return prisma.userProduct.findUnique({
      where: { id },
      include: inventoryInclude,
    });
  },

  findByUserAndProduct(userId, productId) {
    return prisma.userProduct.findUnique({
      where: { userId_productId: { userId, productId } },
      include: inventoryInclude,
    });
  },

  async findMany({ where, skip, take }) {
    const [items, total] = await Promise.all([
      prisma.userProduct.findMany({
        where,
        include: inventoryInclude,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.userProduct.count({ where }),
    ]);
    return { items, total };
  },

  findByUserId(userId) {
    return prisma.userProduct.findMany({
      where: { userId },
      include: {
        product: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  updateQuantity(id, quantity) {
    return prisma.userProduct.update({
      where: { id },
      data: { quantity },
      include: inventoryInclude,
    });
  },

  /**
   * Atomically decrease stock and create a sale row (revenue = qty × unitPrice).
   */
  async recordSale({ inventoryId, soldQuantity, unitPrice, userId, productId }) {
    const revenue = soldQuantity * unitPrice;

    return prisma.$transaction(async (tx) => {
      const current = await tx.userProduct.findUnique({ where: { id: inventoryId } });
      if (!current) {
        throw new Error('NOT_FOUND');
      }
      if (soldQuantity > current.quantity) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      const updated = await tx.userProduct.update({
        where: { id: inventoryId },
        data: { quantity: current.quantity - soldQuantity },
        include: inventoryInclude,
      });

      const sale = await tx.sale.create({
        data: {
          userId,
          productId,
          userProductId: inventoryId,
          quantity: soldQuantity,
          unitPrice,
          revenue,
        },
        include: {
          product: true,
          user: {
            select: { id: true, name: true, email: true, branchId: true },
          },
        },
      });

      return {
        inventory: updated,
        sale,
        previousQuantity: current.quantity,
      };
    });
  },

  delete(id) {
    return prisma.userProduct.delete({
      where: { id },
      include: inventoryInclude,
    });
  },

  userExists(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, email: true, branchId: true },
    });
  },

  productExists(productId) {
    return prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, sku: true },
    });
  },
};

export default inventoryRepository;
