import customerRepository from './customer.repository.js';
import { User } from '../../models/User.js';
import ApiError from '../../utils/ApiError.js';
import { hashPassword } from '../../utils/bcrypt.js';

const customerService = {
  async create(payload, requester) {
    if (payload.email) {
      const existing = await customerRepository.findByEmail(payload.email.toLowerCase());
      if (existing) {
        throw ApiError.conflict('A customer with this email already exists');
      }
    }

    return customerRepository.create({
      name: payload.name.trim(),
      email: payload.email ? payload.email.toLowerCase() : null,
      phone: payload.phone ?? null,
      address: payload.address ?? null,
      notes: payload.notes ?? null,
      createdBy: requester.id,
    });
  },

  async list(query) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const { items, total } = await customerRepository.findMany({
      filters: { search },
      skip,
      take: limit,
    });

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  },

  async getById(id) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }

    const outstandingBalance = await customerRepository.getOutstandingBalance(id);
    return { ...customer, outstandingBalance };
  },

  async update(id, payload) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }

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

  async getInvoices(id, query) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }

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

  async getPurchaseHistory(id, query) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }

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

    return customerRepository.linkPortalAccount(id, user._id);
  },
};

export default customerService;
