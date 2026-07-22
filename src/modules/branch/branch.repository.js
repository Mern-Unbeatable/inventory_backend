import prisma from '../../config/prisma.js';

const branchInclude = {
  country: true,
  _count: { select: { users: true } },
};

const branchRepository = {
  // ---- Country ----
  createCountry(data) {
    return prisma.country.create({ data });
  },

  findCountryById(id) {
    return prisma.country.findUnique({
      where: { id },
      include: {
        branches: true,
        _count: { select: { branches: true } },
      },
    });
  },

  findAllCountries() {
    return prisma.country.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { branches: true } } },
    });
  },

  updateCountry(id, data) {
    return prisma.country.update({ where: { id }, data });
  },

  deleteCountry(id) {
    return prisma.country.delete({ where: { id } });
  },

  // ---- Branch ----
  createBranch(data) {
    return prisma.branch.create({
      data,
      include: branchInclude,
    });
  },

  findBranchById(id) {
    return prisma.branch.findUnique({
      where: { id },
      include: branchInclude,
    });
  },

  async findManyBranches({ where, skip, take }) {
    const [items, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        include: branchInclude,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.branch.count({ where }),
    ]);
    return { items, total };
  },

  updateBranch(id, data) {
    return prisma.branch.update({
      where: { id },
      data,
      include: branchInclude,
    });
  },

  deleteBranch(id) {
    return prisma.branch.delete({ where: { id } });
  },
};

export default branchRepository;
