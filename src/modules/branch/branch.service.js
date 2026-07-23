import branchRepository from './branch.repository.js';
import ApiError from '../../utils/ApiError.js';

const branchService = {
  // ---- Country ----
  async createCountry(payload) {
    return branchRepository.createCountry({
      name: payload.name.trim(),
      code: payload.code?.toUpperCase() ?? null,
    });
  },

  async listCountries() {
    return branchRepository.findAllCountries();
  },

  async getCountry(id) {
    const country = await branchRepository.findCountryById(id);
    if (!country) {
      throw ApiError.notFound('Country not found');
    }
    return country;
  },

  async updateCountry(id, payload) {
    await this.getCountry(id);
    return branchRepository.updateCountry(id, {
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.code !== undefined
        ? { code: payload.code ? payload.code.toUpperCase() : null }
        : {}),
    });
  },

  async deleteCountry(id) {
    await this.getCountry(id);
    return branchRepository.deleteCountry(id);
  },

  // ---- Branch ----
  async createBranch(payload) {
    const country = await branchRepository.findCountryById(payload.countryId);
    if (!country) {
      throw ApiError.badRequest('Country does not exist');
    }

    return branchRepository.createBranch({
      name: payload.name.trim(),
      code: payload.code ?? null,
      countryId: payload.countryId,
    });
  },

  async listBranches(query) {
    const { page, limit, countryId, search } = query;
    const skip = (page - 1) * limit;

    const { items, total } = await branchRepository.findManyBranches({
      filters: { countryId, search },
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

  async getBranch(id) {
    const branch = await branchRepository.findBranchById(id);
    if (!branch) {
      throw ApiError.notFound('Branch not found');
    }
    return branch;
  },

  async updateBranch(id, payload) {
    await this.getBranch(id);

    if (payload.countryId) {
      const country = await branchRepository.findCountryById(payload.countryId);
      if (!country) {
        throw ApiError.badRequest('Country does not exist');
      }
    }

    return branchRepository.updateBranch(id, {
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.code !== undefined ? { code: payload.code } : {}),
      ...(payload.countryId !== undefined ? { countryId: payload.countryId } : {}),
    });
  },

  async deleteBranch(id) {
    await this.getBranch(id);
    return branchRepository.deleteBranch(id);
  },
};

export default branchService;
