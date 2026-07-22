import prisma from '../../config/prisma.js';

const productRepository = {
  create(data) {
    return prisma.product.create({ data });
  },

  findById(id) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        _count: { select: { assignedUsers: true } },
      },
    });
  },

  findByIdForSeller(id, userId) {
    return prisma.product.findFirst({
      where: {
        id,
        assignedUsers: { some: { userId } },
      },
      include: {
        assignedUsers: {
          where: { userId },
          select: { id: true, quantity: true, updatedAt: true },
          take: 1,
        },
      },
    });
  },

  findBySku(sku) {
    return prisma.product.findUnique({ where: { sku } });
  },

  async findMany({ where, skip, take, sellerId = null }) {
    const include = sellerId
      ? {
          assignedUsers: {
            where: { userId: sellerId },
            select: { id: true, quantity: true, updatedAt: true },
            take: 1,
          },
        }
      : {
          _count: { select: { assignedUsers: true } },
        };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include,
      }),
      prisma.product.count({ where }),
    ]);
    return { items, total };
  },

  update(id, data) {
    return prisma.product.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.product.delete({ where: { id } });
  },
};

export default productRepository;
