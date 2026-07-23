import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from './config/mongoose.js';
import { Country } from './models/Country.js';
import { Branch } from './models/Branch.js';
import { User } from './models/User.js';
import { Product } from './models/Product.js';
import { UserProduct } from './models/UserProduct.js';

dotenv.config();

async function upsertCountry({ name, code }) {
  return Country.findOneAndUpdate(
    { name },
    { $setOnInsert: { name, code } },
    { upsert: true, new: true }
  );
}

async function upsertUser({ email, ...data }) {
  return User.findOneAndUpdate(
    { email },
    { $set: data },
    { upsert: true, new: true }
  );
}

async function upsertProduct(product) {
  return Product.findOneAndUpdate(
    { sku: product.sku },
    { $set: product },
    { upsert: true, new: true }
  );
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@inventory.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const adminName = process.env.ADMIN_NAME || 'System Admin';

  console.log('Seeding MongoDB...');
  await connectDatabase();

  const ethiopia = await upsertCountry({ name: 'Ethiopia', code: 'ET' });
  const bangladesh = await upsertCountry({ name: 'Bangladesh', code: 'BD' });

  let addisBranch = await Branch.findOne({ code: 'ADD-01', countryId: ethiopia._id });
  if (!addisBranch) {
    addisBranch = await Branch.create({
      name: 'Addis Ababa HQ',
      code: 'ADD-01',
      countryId: ethiopia._id,
    });
  }

  let dhakaBranch = await Branch.findOne({ code: 'DHK-01', countryId: bangladesh._id });
  if (!dhakaBranch) {
    dhakaBranch = await Branch.create({
      name: 'Dhaka Export Hub',
      code: 'DHK-01',
      countryId: bangladesh._id,
    });
  }

  const hashedAdmin = await bcrypt.hash(adminPassword, 12);
  const admin = await upsertUser({
    email: adminEmail,
    name: adminName,
    password: hashedAdmin,
    role: 'ADMIN',
    branchId: null,
  });

  const hashedSeller = await bcrypt.hash('Seller@12345', 12);
  const seller = await upsertUser({
    email: 'seller.addis@inventory.com',
    name: 'Addis Seller',
    password: hashedSeller,
    role: 'SELLER',
    branchId: addisBranch._id,
  });

  const products = [
    {
      title: 'Hydrating Face Serum',
      sku: 'SKN-SERUM-001',
      description: 'Hyaluronic acid serum for dry climates',
      price: 18.5,
    },
    {
      title: 'SPF 50 Sunscreen Gel',
      sku: 'SKN-SUN-050',
      description: 'Lightweight sun protection for daily use',
      price: 12.0,
    },
    {
      title: 'Night Repair Cream',
      sku: 'SKN-CRM-NITE',
      description: 'Overnight moisturizing cream',
      price: 22.75,
    },
  ];

  const createdProducts = [];
  for (const p of products) {
    createdProducts.push(await upsertProduct(p));
  }

  for (const [index, product] of createdProducts.slice(0, 2).entries()) {
    await UserProduct.findOneAndUpdate(
      { userId: seller._id, productId: product._id },
      {
        $set: { quantity: 25 + index * 10 },
        $setOnInsert: { userId: seller._id, productId: product._id },
      },
      { upsert: true, new: true }
    );
  }

  console.log('Seed completed:');
  console.log(`  Admin:  ${admin.email} / ${adminPassword}`);
  console.log(`  Seller: ${seller.email} / Seller@12345`);
  console.log(`  Branches: ${addisBranch.name}, ${dhakaBranch.name}`);
  console.log(`  Products: ${createdProducts.length}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectDatabase();
  });
