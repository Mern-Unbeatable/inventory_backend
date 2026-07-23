import userRepository from './user.repository.js';
import ApiError from '../../utils/ApiError.js';
import { hashPassword } from '../../utils/bcrypt.js';

const userService = {
  async create(payload) {
    const email = payload.email.toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw ApiError.conflict('Email already registered');
    }

    if (payload.branchId) {
      const branch = await userRepository.branchExists(payload.branchId);
      if (!branch) {
        throw ApiError.badRequest('Branch does not exist');
      }
    }

    if (payload.role === 'SELLER' && !payload.branchId) {
      throw ApiError.badRequest('Sellers must be assigned to a branch');
    }

    const hashed = await hashPassword(payload.password);

    return userRepository.create({
      name: payload.name,
      email,
      password: hashed,
      role: payload.role || 'SELLER',
      branchId: payload.role === 'ADMIN' ? (payload.branchId ?? null) : payload.branchId,
    });
  },

  async list(query) {
    const { page, limit, role, branchId, countryId, search } = query;
    const skip = (page - 1) * limit;

    const { users, total } = await userRepository.findMany({
      filters: { role, branchId, countryId, search },
      skip,
      take: limit,
    });

    return {
      items: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async getById(id, requester) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Sellers may only view their own profile
    if (requester.role === 'SELLER' && requester.id !== id) {
      throw ApiError.forbidden('You can only view your own profile');
    }

    return user;
  },

  async update(id, payload) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (payload.email) {
      const email = payload.email.toLowerCase();
      const existing = await userRepository.findByEmail(email);
      if (existing && existing.id !== id) {
        throw ApiError.conflict('Email already registered');
      }
      payload.email = email;
    }

    if (payload.branchId) {
      const branch = await userRepository.branchExists(payload.branchId);
      if (!branch) {
        throw ApiError.badRequest('Branch does not exist');
      }
    }

    const nextRole = payload.role ?? user.role;
    const nextBranchId =
      payload.branchId !== undefined ? payload.branchId : user.branchId;

    if (nextRole === 'SELLER' && !nextBranchId) {
      throw ApiError.badRequest('Sellers must be assigned to a branch');
    }

    const data = { ...payload };
    if (payload.password) {
      data.password = await hashPassword(payload.password);
    }

    return userRepository.update(id, data);
  },

  async remove(id, requesterId) {
    if (id === requesterId) {
      throw ApiError.badRequest('You cannot delete your own account');
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return userRepository.delete(id);
  },
};

export default userService;
