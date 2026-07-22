import prisma from '../../config/prisma.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  branchId: true,
  createdAt: true,
  updatedAt: true,
  branch: {
    include: { country: true },
  },
};

const userRepository = {
  create(data) {
    return prisma.user.create({
      data,
      select: userSelect,
    });
  },

  findById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
  },

  findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  async findMany({ where, skip, take }) {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, total };
  },

  update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  },

  delete(id) {
    return prisma.user.delete({
      where: { id },
      select: { id: true, email: true },
    });
  },

  branchExists(branchId) {
    return prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
  },
};

export default userRepository;
