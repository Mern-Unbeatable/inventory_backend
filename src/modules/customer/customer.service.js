import customerRepository from './customer.repository.js';
import { User } from '../../models/User.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import ApiError from '../../utils/ApiError.js';
import { hashPassword } from '../../utils/bcrypt.js';
import {
  assertCustomerAccess,
  validateBranchAndCountry,
} from './customer.access.js';

const buildCreatePayload = async (payload, requester) => {
  await validateBranchAndCountry({
    countryId: payload.countryId,
    branchId: payload.branchId,
    requester,
  });

  const data = {
    name: payload.name.trim(),
    countryId: payload.countryId,
    branchId: payload.branchId,
    createdBy: requester.id,
    createdByRole: requester.role,
  };

  if (payload.email) {
    data.email = payload.email.toLowerCase();
  }
  if (payload.phone) {
    data.phone = payload.phone;
  }
  if (payload.address) {
    data.address = payload.address;
  }
  if (payload.notes) {
    data.notes = payload.notes;
  }

  return data;
};

const sellerListFilters = (requester) => {
  if (requester.role !== 'SELLER') return {};
  return { branchId: requester.branchId };
};

const customerService = {
  async create(payload, requester) {
    if (payload.email) {
      const existing = await customerRepository.findByEmail(payload.email.toLowerCase());
      if (existing) {
        throw ApiError.conflict('A customer with this email already exists');
      }
    }

    const data = await buildCreatePayload(payload, requester);
    return customerRepository.create(data);
  },

  async list(query, requester) {
    const { page, limit, search, countryId, branchId } = query;
    const skip = (page - 1) * limit;

    const scopeFilters = sellerListFilters(requester);

    const { items, total } = await customerRepository.findMany({
      filters: {
        search,
        countryId: scopeFilters.branchId ? undefined : countryId,
        branchId: scopeFilters.branchId || branchId,
      },
      skip,
      take: limit,
    });

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  },

  async getById(id, requester) {
    const customer = await customerRepository.findById(id);
    assertCustomerAccess(customer, requester);

    const outstandingBalance = await customerRepository.getOutstandingBalance(id);
    return { ...customer, outstandingBalance };
  },

  async update(id, payload, requester) {
    const customer = await customerRepository.findById(id);
    assertCustomerAccess(customer, requester);

    const data = {};
    if (payload.name !== undefined) data.name = payload.name.trim();
    if (payload.phone !== undefined) data.phone = payload.phone;
    if (payload.address !== undefined) data.address = payload.address;
    if (payload.notes !== undefined) data.notes = payload.notes;

    if (payload.email !== undefined) {
      const email = payload.email ? payload.email.toLowerCase() : null;
      if (email) {
        const existing = await customerRepository.findByEmail(email);
        if (existing && existing.id !== id) {
          throw ApiError.conflict('A customer with this email already exists');
        }
      }
      data.email = email;
    }

    if (payload.countryId !== undefined || payload.branchId !== undefined) {
      if (requester.role !== 'ADMIN') {
        throw ApiError.forbidden('Only admins can change a customer country or branch');
      }

      const nextCountryId = payload.countryId ?? customer.countryId;
      const nextBranchId = payload.branchId ?? customer.branchId;

      await validateBranchAndCountry({
        countryId: nextCountryId,
        branchId: nextBranchId,
        requester,
      });

      data.countryId = nextCountryId;
      data.branchId = nextBranchId;
    }

    return customerRepository.update(id, data);
  },

  async remove(id) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }

    const invoiceCount = await customerRepository.invoiceCount(id);
    if (invoiceCount > 0) {
      throw ApiError.badRequest(
        'Cannot delete a customer with existing invoices. Cancel or reassign them first.'
      );
    }

    return customerRepository.delete(id);
  },

  async getInvoices(id, query, requester) {
    const customer = await customerRepository.findById(id);
    assertCustomerAccess(customer, requester);

    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const { items, total } = await customerRepository.findInvoicesByCustomer(id, {
      status,
      skip,
      take: limit,
    });

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  },

  async getPurchaseHistory(id, query, requester) {
    const customer = await customerRepository.findById(id);
    assertCustomerAccess(customer, requester);

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const { items, total } = await customerRepository.getPurchaseHistory(id, {
      skip,
      take: limit,
    });

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  },

  /** Admin-only: create (or link) a CUSTOMER-role portal login for this customer record. */
  async createPortalAccount(id, payload) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }
    if (customer.userId) {
      throw ApiError.conflict('This customer already has a portal account');
    }

    const email = payload.email.toLowerCase();
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.conflict('Email already registered to a user account');
    }

    const hashed = await hashPassword(payload.password);
    const user = await User.create({
      name: customer.name,
      email,
      password: hashed,
      role: 'CUSTOMER',
      branchId: null,
    });

    const alreadyLinked = await customerRepository.findByUserId(user._id);
    if (alreadyLinked && alreadyLinked.id !== id) {
      throw ApiError.conflict('This portal user is already linked to another customer');
    }

    return customerRepository.linkPortalAccount(id, user._id);
  },

  /** Admin-only: set a new password on the linked CUSTOMER portal login. */
  async updatePortalPassword(id, { password }) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }
    if (!customer.userId) {
      throw ApiError.badRequest('This customer has no portal account');
    }

    const user = await User.findById(customer.userId);
    if (!user || user.role !== 'CUSTOMER') {
      throw ApiError.notFound('Portal account not found');
    }

    user.password = await hashPassword(password);
    await user.save();
    await RefreshToken.deleteMany({ userId: user._id });

    return { updated: true };
  },

  async resolveCountryIdForPortalUser(userId) {
    return customerRepository.findCountryIdByUserId(userId);
  },
};

export default customerService;
