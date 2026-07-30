import { Customer } from '../../models/Customer.js';
import { Branch } from '../../models/Branch.js';

/**
 * One-time-safe repair: drop legacy null userId/email values, backfill geography,
 * and align indexes with the partial unique definitions in Customer.js.
 */
export async function ensureCustomerIndexes() {
  await Customer.updateMany({ userId: null }, { $unset: { userId: '' } });
  await Customer.updateMany({ email: null }, { $unset: { email: '' } });

  const defaultBranch = await Branch.findOne({ code: 'ADD-01' });
  if (defaultBranch) {
    await Customer.updateMany(
      {
        $or: [{ branchId: { $exists: false } }, { branchId: null }],
      },
      {
        $set: {
          branchId: defaultBranch._id,
          countryId: defaultBranch.countryId,
          createdByRole: 'ADMIN',
        },
      }
    );
  }

  await Customer.syncIndexes();
}
