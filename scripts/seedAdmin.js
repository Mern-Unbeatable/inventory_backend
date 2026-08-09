import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/mongoose.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/utils/bcrypt.js';

dotenv.config();

async function seedAdminOnly() {
  const adminName = process.env.ADMIN_NAME || 'System Admin';
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required in .env');
  }

  await connectDatabase();

  console.log('Dropping entire database...');
  await mongoose.connection.dropDatabase();
  console.log('Database dropped.');

  const password = await hashPassword(adminPassword);
  const admin = await User.create({
    name: adminName,
    email: adminEmail,
    password,
    role: 'ADMIN',
    branchId: null,
  });

  console.log('Admin seeded:');
  console.log(`  name:  ${admin.name}`);
  console.log(`  email: ${admin.email}`);
  console.log(`  role:  ${admin.role}`);
}

seedAdminOnly()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Admin seed failed:', err.message);
    try {
      await disconnectDatabase();
    } catch {
      // ignore disconnect errors after failure
    }
    process.exit(1);
  });
