import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@inventory.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const adminName = process.env.ADMIN_NAME || 'System Admin';

  console.log('Seeding database...');

  const ethiopia = await prisma.country.upsert({
    where: { name: 'Ethiopia' },
    update: {},
    create: { name: 'Ethiopia', code: 'ET' },
  });

  const bangladesh = await prisma.country.upsert({
    where: { name: 'Bangladesh' },
    update: {},
    create: { name: 'Bangladesh', code: 'BD' },
  });

  let addisBranch = await prisma.branch.findFirst({
    where: { code: 'ADD-01', countryId: ethiopia.id },
  });
  if (!addisBranch) {
    addisBranch = await prisma.branch.create({
      data: {
        name: 'Addis Ababa HQ',
        code: 'ADD-01',
        countryId: ethiopia.id,
      },
    });
  }

  let dhakaBranch = await prisma.branch.findFirst({
    where: { code: 'DHK-01', countryId: bangladesh.id },
  });
  if (!dhakaBranch) {
    dhakaBranch = await prisma.branch.create({
      data: {
        name: 'Dhaka Export Hub',
        code: 'DHK-01',
        countryId: bangladesh.id,
      },
    });
  }

  const hashedAdmin = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      password: hashedAdmin,
      role: 'ADMIN',
    },
    create: {
      name: adminName,
      email: adminEmail,
      password: hashedAdmin,
      role: 'ADMIN',
    },
  });

  const hashedSeller = await bcrypt.hash('Seller@12345', 12);
  const seller = await prisma.user.upsert({
    where: { email: 'seller.addis@inventory.com' },
    update: {
      name: 'Addis Seller',
      password: hashedSeller,
      role: 'SELLER',
      branchId: addisBranch.id,
    },
    create: {
      name: 'Addis Seller',
      email: 'seller.addis@inventory.com',
      password: hashedSeller,
      role: 'SELLER',
      branchId: addisBranch.id,
    },
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
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        title: p.title,
        description: p.description,
        price: p.price,
      },
      create: p,
    });
    createdProducts.push(product);
  }

  // Assign first two products to the sample seller
  for (const [index, product] of createdProducts.slice(0, 2).entries()) {
    await prisma.userProduct.upsert({
      where: {
        userId_productId: {
          userId: seller.id,
          productId: product.id,
        },
      },
      update: { quantity: 25 + index * 10 },
      create: {
        userId: seller.id,
        productId: product.id,
        quantity: 25 + index * 10,
      },
    });
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
    await prisma.$disconnect();
  });
