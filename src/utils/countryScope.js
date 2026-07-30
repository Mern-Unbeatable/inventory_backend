import { Branch } from '../models/Branch.js';
import { User } from '../models/User.js';

/** Seller user IDs whose branch belongs to the given country. */
export async function getSellerIdsByCountry(countryId) {
  if (!countryId) return [];

  const branchIds = await Branch.find({ countryId }).distinct('_id');
  if (!branchIds.length) return [];

  return User.find({
    branchId: { $in: branchIds },
    role: 'SELLER',
  }).distinct('_id');
}
