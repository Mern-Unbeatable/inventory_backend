import branchRepository from "./branch.repository.js";
import { Branch } from "../../models/Branch.js";
import ApiError from "../../utils/ApiError.js";

const branchService = {
  // ---- Country ----
  async createCountry(payload) {
    return branchRepository.createCountry({
      name: payload.name.trim(),
      code: payload.code?.toUpperCase() ?? null,
    });
  },

  async listCountries(requester) {
    const countries = await branchRepository.findAllCountries();

    if (requester?.role === "SELLER") {
      if (!requester.branchId) {
        return [];
      }
      const branch = await Branch.findById(requester.branchId).select(
        "countryId",
      );
      if (!branch?.countryId) return [];
      return countries.filter((country) => country.id === branch.countryId);
    }

    return countries;
  },

  async getCountry(id, requester) {
    const country = await branchRepository.findCountryById(id);
    if (!country) {
      throw ApiError.notFound("Country not found");
    }

    if (requester?.role === "SELLER") {
      if (!requester.branchId) {
        throw ApiError.forbidden(
          "Your seller account is not assigned to a branch",
        );
      }
      const branch = await Branch.findById(requester.branchId).select(
        "countryId",
      );
      if (!branch || branch.countryId !== id) {
        throw ApiError.forbidden("You can only access your assigned country");
      }
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
      throw ApiError.badRequest("Country does not exist");
    }

    return branchRepository.createBranch({
      name: payload.name.trim(),
      code: payload.code ?? null,
      countryId: payload.countryId,
    });
  },

  async listBranches(query, requester) {
    const { page, limit, countryId, search } = query;
    const skip = (page - 1) * limit;

    const filters = { countryId, search };

    if (requester?.role === "SELLER") {
      if (!requester.branchId) {
        return {
          items: [],
          meta: { page, limit, total: 0, totalPages: 1 },
        };
      }
      filters.branchId = requester.branchId;
    }

    const { items, total } = await branchRepository.findManyBranches({
      filters,
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

  async getBranch(id, requester) {
    const branch = await branchRepository.findBranchById(id);
    if (!branch) {
      throw ApiError.notFound("Branch not found");
    }

    if (requester?.role === "SELLER" && id !== requester.branchId) {
      throw ApiError.forbidden("You can only access your assigned branch");
    }

    return branch;
  },

  async updateBranch(id, payload) {
    await this.getBranch(id);

    if (payload.countryId) {
      const country = await branchRepository.findCountryById(payload.countryId);
      if (!country) {
        throw ApiError.badRequest("Country does not exist");
      }
    }

    return branchRepository.updateBranch(id, {
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.code !== undefined ? { code: payload.code } : {}),
      ...(payload.countryId !== undefined
        ? { countryId: payload.countryId }
        : {}),
    });
  },

  async deleteBranch(id) {
    await this.getBranch(id);
    return branchRepository.deleteBranch(id);
  },

  async bulkDeleteBranches(ids) {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) {
      throw ApiError.badRequest("At least one branch is required");
    }

    const existingBranches = await branchRepository.findManyByIds(uniqueIds);
    const existingIds = existingBranches.map((branch) => branch.id);
    const missingIds = uniqueIds.filter((id) => !existingIds.includes(id));

    if (missingIds.length) {
      throw ApiError.notFound(
        `Some branch records could not be found: ${missingIds.join(", ")}`,
      );
    }

    const deletedCount = await branchRepository.bulkDeleteBranches(uniqueIds);
    return { deletedCount, ids: uniqueIds };
  },
};

export default branchService;
