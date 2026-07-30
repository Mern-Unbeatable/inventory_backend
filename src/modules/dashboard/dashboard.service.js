import dashboardRepository from './dashboard.repository.js';
import customerRepository from '../customer/customer.repository.js';

const dashboardService = {
  async getOverview(requester) {
    if (requester.role === 'ADMIN') {
      const stats = await dashboardRepository.getAdminStats();
      return { role: 'ADMIN', ...stats };
    }

    if (requester.role === 'CUSTOMER') {
      const countryId = await customerRepository.findCountryIdByUserId(requester.id);
      const stats = await dashboardRepository.getCustomerStats(countryId);
      return { role: 'CUSTOMER', ...stats };
    }

    const stats = await dashboardRepository.getSellerStats(requester.id);
    return { role: 'SELLER', ...stats };
  },
};

export default dashboardService;
