import dns from 'node:dns';
import mongoose from 'mongoose';
import env from './env.js';
import { ensureCustomerIndexes } from '../modules/customer/customer.indexes.js';

mongoose.set('strictQuery', true);

/**
 * Some Windows/ISP DNS resolvers refuse SRV queries that `mongodb+srv://` needs.
 * Prefer public DNS before connecting when using SRV URIs.
 */
const ensureSrvFriendlyDns = (uri) => {
  if (!uri.startsWith('mongodb+srv://')) return;
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    // ignore — connection will still be attempted
  }
};

export const connectDatabase = async () => {
  const uri = env.mongodbUri?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is missing');
  }

  ensureSrvFriendlyDns(uri);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15_000,
      family: 4,
    });

    await ensureCustomerIndexes();
  } catch (error) {
    if (error?.code === 'ECONNREFUSED' || error?.message?.includes('querySrv')) {
      const hint = [
        'MongoDB DNS/SRV lookup failed for mongodb+srv://',
        'Fixes to try:',
        '1) Atlas → Network Access → allow your IP (or 0.0.0.0/0 for dev)',
        '2) Use a standard mongodb:// shard URI (no +srv) in MONGODB_URI',
        '3) Check internet/DNS/VPN/firewall',
        '4) URL-encode special characters in the password',
      ].join('\n');
      error.message = `${error.message}\n\n${hint}`;
    }
    throw error;
  }

  return mongoose.connection;
};

export const disconnectDatabase = async () => {
  await mongoose.disconnect();
};

export default mongoose;
