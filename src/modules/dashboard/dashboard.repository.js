import prisma from '../../config/prisma.js';

const dashboardRepository = {
  async getAdminStats() {
    const [
      countries,
      branches,
      users,
      sellers,
      products,
      assignments,
      stockAgg,
      lowStock,
      revenueAgg,
      unitsSoldAgg,
    ] = await Promise.all([
      prisma.country.count(),
      prisma.branch.count(),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'SELLER' } }),
      prisma.product.count(),
      prisma.userProduct.count(),
      prisma.userProduct.aggregate({ _sum: { quantity: true } }),
      prisma.userProduct.count({ where: { quantity: { lte: 5 } } }),
      prisma.sale.aggregate({ _sum: { revenue: true }, _count: true }),
      prisma.sale.aggregate({ _sum: { quantity: true } }),
    ]);

    const stockByCountry = await prisma.country.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        branches: {
          select: {
            id: true,
            name: true,
            users: {
              select: {
                id: true,
                assignedProducts: {
                  select: { quantity: true },
                },
                sales: {
                  select: { revenue: true, quantity: true },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const countryBreakdown = stockByCountry.map((country) => {
      let totalQuantity = 0;
      let revenue = 0;
      let unitsSold = 0;
      let sellerCount = 0;
      for (const branch of country.branches) {
        for (const user of branch.users) {
          sellerCount += 1;
          for (const ap of user.assignedProducts) {
            totalQuantity += ap.quantity;
          }
          for (const sale of user.sales) {
            revenue += sale.revenue;
            unitsSold += sale.quantity;
          }
        }
      }
      return {
        id: country.id,
        name: country.name,
        code: country.code,
        branchCount: country.branches.length,
        sellerCount,
        totalQuantity,
        revenue,
        unitsSold,
      };
    });

    const recentSales = await prisma.sale.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, title: true, sku: true, price: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            branch: { select: { id: true, name: true, country: true } },
          },
        },
      },
    });

    return {
      totals: {
        countries,
        branches,
        users,
        sellers,
        products,
        assignments,
        totalStockQuantity: stockAgg._sum.quantity ?? 0,
        revenue: revenueAgg._sum.revenue ?? 0,
        unitsSold: unitsSoldAgg._sum.quantity ?? 0,
        salesCount: revenueAgg._count ?? 0,
        lowStockAssignments: lowStock,
      },
      countryBreakdown,
      recentSales,
    };
  },

  async getSellerStats(userId) {
    const [assignments, stockAgg, lowStock, revenueAgg, unitsSoldAgg] = await Promise.all([
      prisma.userProduct.count({ where: { userId } }),
      prisma.userProduct.aggregate({
        where: { userId },
        _sum: { quantity: true },
      }),
      prisma.userProduct.count({
        where: { userId, quantity: { lte: 5 } },
      }),
      prisma.sale.aggregate({
        where: { userId },
        _sum: { revenue: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: { userId },
        _sum: { quantity: true },
      }),
    ]);

    const recentSales = await prisma.sale.findMany({
      where: { userId },
      include: {
        product: { select: { id: true, title: true, sku: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    return {
      totals: {
        assignedProducts: assignments,
        totalStockQuantity: stockAgg._sum.quantity ?? 0,
        revenue: revenueAgg._sum.revenue ?? 0,
        unitsSold: unitsSoldAgg._sum.quantity ?? 0,
        salesCount: revenueAgg._count ?? 0,
        lowStockProducts: lowStock,
      },
      recentSales,
    };
  },
};

export default dashboardRepository;
