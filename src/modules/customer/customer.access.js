import { Branch } from '../../models/Branch.js';
import ApiError from '../../utils/ApiError.js';

export const assertCustomerAccess = (customer, requester) => {
  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  if (requester.role === 'ADMIN') {
    return customer;
  }

  if (requester.role === 'SELLER') {
    if (!requester.branchId) {
      throw ApiError.forbidden('Your seller account is not assigned to a branch');
    }
    if (customer.branchId !== requester.branchId) {
      throw ApiError.forbidden('You can only access customers in your branch');
    }
    return customer;
  }

  throw ApiError.forbidden('You do not have access to this customer');
};

export const assertSellerBranchAssignment = (requester) => {
  if (requester.role !== 'SELLER') return;
  if (!requester.branchId) {
    throw ApiError.forbidden('Your seller account is not assigned to a branch');
  }
};

export const validateBranchAndCountry = async ({
  countryId,
  branchId,
  requester,
}) => {
  const branch = await Branch.findById(branchId).populate('countryId');
  if (!branch) {
    throw ApiError.badRequest('Selected branch does not exist', [
      { path: 'branchId', message: 'Branch not found' },
    ]);
  }

  const branchCountryId =
    branch.countryId && typeof branch.countryId === 'object'
      ? branch.countryId._id
      : branch.countryId;

  if (branchCountryId !== countryId) {
    throw ApiError.badRequest('Branch does not belong to the selected country', [
      { path: 'branchId', message: 'Branch must belong to the selected country' },
    ]);
  }

  if (requester.role === 'SELLER') {
    assertSellerBranchAssignment(requester);
    if (branchId !== requester.branchId) {
      throw ApiError.forbidden(
        'You can only create customers for your assigned branch'
      );
    }
  }

  return {
    countryId,
    branchId,
    branchName: branch.name,
    countryName:
      branch.countryId && typeof branch.countryId === 'object'
        ? branch.countryId.name
        : null,
  };
};
