import dashboardRepository from './dashboard.repository.js';

const dashboardService = {
  async getOverview(requester) {
    if (requester.role === 'ADMIN') {
      const stats = await dashboardRepository.getAdminStats();
      return { role: 'ADMIN', ...stats };
    }

    const stats = await dashboardRepository.getSellerStats(requester.id);
    return { role: 'SELLER', ...stats };
  },
};

export default dashboardService;
