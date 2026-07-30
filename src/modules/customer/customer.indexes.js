import { Customer } from '../../models/Customer.js';

/**
 * One-time-safe repair: drop legacy null userId/email values and align indexes
 * with the partial unique definitions in Customer.js.
 */
export async function ensureCustomerIndexes() {
  await Customer.updateMany({ userId: null }, { $unset: { userId: '' } });
  await Customer.updateMany({ email: null }, { $unset: { email: '' } });
  await Customer.syncIndexes();
}
