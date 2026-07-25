import dashboardRepository from './dashboard.repository.js';

const dashboardService = {
  async getOverview(requester) {
    if (requester.role === 'ADMIN') {
      const stats = await dashboardRepository.getAdminStats();
      return { role: 'ADMIN', ...stats };
    }

    if (requester.role === 'CUSTOMER') {
      const stats = await dashboardRepository.getCustomerStats();
      return { role: 'CUSTOMER', ...stats };
    }

    const stats = await dashboardRepository.getSellerStats(requester.id);
    return { role: 'SELLER', ...stats };
  },
};

export default dashboardService;
