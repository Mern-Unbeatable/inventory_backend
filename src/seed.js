import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from './config/mongoose.js';
import mongoose from 'mongoose';
import { Country } from './models/Country.js';
import { Branch } from './models/Branch.js';
import { User } from './models/User.js';
import { Product } from './models/Product.js';
import { UserProduct } from './models/UserProduct.js';
import { Sale } from './models/Sale.js';
import { Customer } from './models/Customer.js';
import { Invoice } from './models/Invoice.js';
import { InvoiceItem } from './models/InvoiceItem.js';
import { Payment } from './models/Payment.js';
import { InventoryTransaction } from './models/InventoryTransaction.js';

dotenv.config();

/**
 * --reset (or RESET_DB=true) drops the ENTIRE database before seeding —
 * every collection, including ones not touched below (e.g. refresh_tokens).
 * Without the flag, seeding stays non-destructive (upsert-only), as before.
 */
const shouldReset = process.argv.includes('--reset') || process.env.RESET_DB === 'true';

async function resetDatabase() {
  console.log('⚠️  --reset flag detected: dropping the entire database...');
  await mongoose.connection.dropDatabase();
  console.log('✅ Database dropped. Seeding fresh data...');
}

async function upsertCountry({ name, code }) {
  return Country.findOneAndUpdate(
    { name },
    { $setOnInsert: { name, code } },
    { upsert: true, new: true }
  );
}

async function upsertBranch({ name, code, countryId }) {
  return Branch.findOneAndUpdate(
    { code, countryId },
    { $setOnInsert: { name, code, countryId } },
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

async function upsertAssignment({ userId, productId, quantity }) {
  return UserProduct.findOneAndUpdate(
    { userId, productId },
    {
      $set: { quantity },
      $setOnInsert: { userId, productId },
    },
    { upsert: true, new: true }
  );
}

/** Creates a Sale row without mutating current UserProduct.quantity — the
 *  seeded assignment quantities already represent "current stock after
 *  these historical sales", so this only backfills reporting history. */
async function seedSale({ userId, productId, userProductId, quantity, unitPrice, daysAgo }) {
  const revenue = quantity * unitPrice;
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return Sale.create({
    userId,
    productId,
    userProductId,
    quantity,
    unitPrice,
    revenue,
    createdAt,
  });
}

async function upsertCustomer({ email, ...data }) {
  return Customer.findOneAndUpdate(
    { email },
    { $set: data, $setOnInsert: { email } },
    { upsert: true, new: true }
  );
}

/** Idempotent invoice upsert (natural key: invoiceNumber) — replaces its items each run. */
async function upsertInvoice({ invoiceNumber, customerId, sellerId, status, notes, items, paidAmount = 0 }) {
  const totalAmount =
    Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100;
  const dueAmount = Math.max(totalAmount - paidAmount, 0);
  let paymentStatus = 'UNPAID';
  if (totalAmount <= 0 || paidAmount >= totalAmount) paymentStatus = 'PAID';
  else if (paidAmount > 0) paymentStatus = 'PARTIALLY_PAID';

  const invoice = await Invoice.findOneAndUpdate(
    { invoiceNumber },
    {
      $set: {
        customerId,
        sellerId,
        status,
        notes: notes ?? null,
        totalAmount,
        paidAmount,
        dueAmount,
        paymentStatus,
        ...(status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
      },
      $setOnInsert: { invoiceNumber },
    },
    { upsert: true, new: true }
  );

  await InvoiceItem.deleteMany({ invoiceId: invoice._id });
  await InvoiceItem.insertMany(
    items.map((item) => ({
      invoiceId: invoice._id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }))
  );

  return invoice;
}

/** Idempotent payment replace for a given invoice (seed-only convenience). */
async function upsertPayment({ invoiceId, amount, paymentMethod, notes, recordedBy, daysAgo }) {
  await Payment.deleteMany({ invoiceId });
  return Payment.create({
    invoiceId,
    amount,
    paymentMethod,
    notes: notes ?? null,
    recordedBy,
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    paymentDate: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  });
}

/** Idempotent inventory-transaction replace, so re-running seed doesn't duplicate ledger rows. */
async function upsertInventoryTransaction({ userProductId, userId, productId, type, beforeQuantity, changeQuantity, afterQuantity, reason, performedBy, daysAgo }) {
  await InventoryTransaction.deleteMany({ userProductId, type, reason });
  return InventoryTransaction.create({
    userProductId,
    userId,
    productId,
    type,
    beforeQuantity,
    changeQuantity,
    afterQuantity,
    reason,
    performedBy,
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  });
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@inventory.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const adminName = process.env.ADMIN_NAME || 'System Admin';
  const sellerPassword = 'Seller@12345';

  console.log('Seeding MongoDB...');
  await connectDatabase();

  if (shouldReset) {
    await resetDatabase();
  }

  // ---- Countries ----
  const ethiopia = await upsertCountry({ name: 'Ethiopia', code: 'ET' });
  const bangladesh = await upsertCountry({ name: 'Bangladesh', code: 'BD' });

  // ---- Branches (2 per country) ----
  const addisBranch = await upsertBranch({
    name: 'Addis Ababa HQ',
    code: 'ADD-01',
    countryId: ethiopia._id,
  });
  const hawassaBranch = await upsertBranch({
    name: 'Hawassa Branch',
    code: 'HWS-01',
    countryId: ethiopia._id,
  });
  const dhakaBranch = await upsertBranch({
    name: 'Dhaka Export Hub',
    code: 'DHK-01',
    countryId: bangladesh._id,
  });
  const chittagongBranch = await upsertBranch({
    name: 'Chittagong Port Branch',
    code: 'CTG-01',
    countryId: bangladesh._id,
  });

  // ---- Users: 1 admin + 4 sellers (one per branch) ----
  const hashedAdmin = await bcrypt.hash(adminPassword, 12);
  const admin = await upsertUser({
    email: adminEmail,
    name: adminName,
    password: hashedAdmin,
    role: 'ADMIN',
    branchId: null,
  });

  const hashedSeller = await bcrypt.hash(sellerPassword, 12);
  const sellerDefs = [
    { email: 'seller.addis@inventory.com', name: 'Addis Seller', branch: addisBranch },
    { email: 'seller.hawassa@inventory.com', name: 'Hawassa Seller', branch: hawassaBranch },
    { email: 'seller.dhaka@inventory.com', name: 'Dhaka Seller', branch: dhakaBranch },
    { email: 'seller.chittagong@inventory.com', name: 'Chittagong Seller', branch: chittagongBranch },
  ];

  const sellers = {};
  for (const def of sellerDefs) {
    sellers[def.email] = await upsertUser({
      email: def.email,
      name: def.name,
      password: hashedSeller,
      role: 'SELLER',
      branchId: def.branch._id,
    });
  }

  // ---- Products: full skincare catalog ----
  const productDefs = [
    { title: 'Hydrating Face Serum', sku: 'SKN-SERUM-001', description: 'Hyaluronic acid serum for dry climates', price: 18.5 },
    { title: 'SPF 50 Sunscreen Gel', sku: 'SKN-SUN-050', description: 'Lightweight sun protection for daily use', price: 12.0 },
    { title: 'Night Repair Cream', sku: 'SKN-CRM-NITE', description: 'Overnight moisturizing cream', price: 22.75 },
    { title: 'Vitamin C Brightening Serum', sku: 'SKN-VITC-001', description: 'Antioxidant serum for dull skin', price: 19.99 },
    { title: 'Gentle Foaming Cleanser', sku: 'SKN-CLN-001', description: 'Daily sulfate-free facial cleanser', price: 9.5 },
    { title: 'Rose Water Toner', sku: 'SKN-TNR-002', description: 'Alcohol-free hydrating toner', price: 8.25 },
    { title: 'Retinol Night Serum', sku: 'SKN-RET-003', description: 'Anti-aging retinol treatment', price: 27.0 },
    { title: 'Charcoal Detox Mask', sku: 'SKN-MSK-004', description: 'Deep-cleansing clay & charcoal mask', price: 14.75 },
  ];

  const products = {};
  for (const def of productDefs) {
    products[def.sku] = await upsertProduct(def);
  }

  // ---- Inventory assignments (quantities intentionally vary; some ≤5 to
  // demo the "low stock" indicator on both dashboards) ----
  const assignmentDefs = [
    { seller: 'seller.addis@inventory.com', sku: 'SKN-SERUM-001', quantity: 35 },
    { seller: 'seller.addis@inventory.com', sku: 'SKN-SUN-050', quantity: 20 },
    { seller: 'seller.addis@inventory.com', sku: 'SKN-VITC-001', quantity: 4 },
    { seller: 'seller.hawassa@inventory.com', sku: 'SKN-CRM-NITE', quantity: 50 },
    { seller: 'seller.hawassa@inventory.com', sku: 'SKN-CLN-001', quantity: 60 },
    { seller: 'seller.dhaka@inventory.com', sku: 'SKN-TNR-002', quantity: 45 },
    { seller: 'seller.dhaka@inventory.com', sku: 'SKN-RET-003', quantity: 2 },
    { seller: 'seller.dhaka@inventory.com', sku: 'SKN-SUN-050', quantity: 30 },
    { seller: 'seller.chittagong@inventory.com', sku: 'SKN-MSK-004', quantity: 25 },
    { seller: 'seller.chittagong@inventory.com', sku: 'SKN-SERUM-001', quantity: 15 },
    { seller: 'seller.chittagong@inventory.com', sku: 'SKN-CRM-NITE', quantity: 5 },
  ];

  const assignments = {};
  for (const def of assignmentDefs) {
    const seller = sellers[def.seller];
    const product = products[def.sku];
    const row = await upsertAssignment({
      userId: seller._id,
      productId: product._id,
      quantity: def.quantity,
    });
    assignments[`${def.seller}:${def.sku}`] = row;
  }

  // ---- A handful of historical sales so dashboards/revenue aren't empty ----
  const saleDefs = [
    { seller: 'seller.addis@inventory.com', sku: 'SKN-SERUM-001', quantity: 5, daysAgo: 6 },
    { seller: 'seller.addis@inventory.com', sku: 'SKN-VITC-001', quantity: 2, daysAgo: 2 },
    { seller: 'seller.hawassa@inventory.com', sku: 'SKN-CLN-001', quantity: 8, daysAgo: 4 },
    { seller: 'seller.dhaka@inventory.com', sku: 'SKN-RET-003', quantity: 3, daysAgo: 1 },
    { seller: 'seller.dhaka@inventory.com', sku: 'SKN-TNR-002', quantity: 10, daysAgo: 5 },
    { seller: 'seller.chittagong@inventory.com', sku: 'SKN-MSK-004', quantity: 6, daysAgo: 3 },
  ];

  for (const def of saleDefs) {
    const seller = sellers[def.seller];
    const product = products[def.sku];
    const assignment = assignments[`${def.seller}:${def.sku}`];
    await seedSale({
      userId: seller._id,
      productId: product._id,
      userProductId: assignment?._id ?? null,
      quantity: def.quantity,
      unitPrice: product.price,
      daysAgo: def.daysAgo,
    });
  }

  // ---- Customer portal login + CRM records ----
  const customerPortalPassword = 'Customer@12345';
  const hashedCustomer = await bcrypt.hash(customerPortalPassword, 12);
  const customerPortalUser = await upsertUser({
    email: 'customer.portal@inventory.com',
    name: 'Nomi Retail Store',
    password: hashedCustomer,
    role: 'CUSTOMER',
    branchId: null,
  });

  const nomiRetail = await upsertCustomer({
    email: 'nomi.retail@example.com',
    name: 'Nomi Retail Store',
    phone: '+251-911-000111',
    address: 'Bole Road, Addis Ababa, Ethiopia',
    notes: 'Repeat retail buyer — has portal login.',
    userId: customerPortalUser._id,
    createdBy: admin._id,
  });

  const bezaTrading = await upsertCustomer({
    email: 'beza.trading@example.com',
    name: 'Beza Trading PLC',
    phone: '+251-911-000222',
    address: 'Piazza, Addis Ababa, Ethiopia',
    notes: 'Wholesale buyer, pays on credit — no portal login.',
    createdBy: admin._id,
  });

  // ---- Invoices: one editable draft, one confirmed with a partial payment ----
  const addisSeller = sellers['seller.addis@inventory.com'];
  const hawassaSeller = sellers['seller.hawassa@inventory.com'];
  const sunscreen = products['SKN-SUN-050'];
  const cleanser = products['SKN-CLN-001'];

  const draftInvoice = await upsertInvoice({
    invoiceNumber: 'INV-SEED-000001',
    customerId: nomiRetail._id,
    sellerId: addisSeller._id,
    status: 'DRAFT',
    notes: 'Sample draft invoice — awaiting confirmation (no stock impact yet).',
    items: [{ productId: sunscreen._id, quantity: 3, unitPrice: sunscreen.price }],
  });

  const confirmedInvoice = await upsertInvoice({
    invoiceNumber: 'INV-SEED-000002',
    customerId: bezaTrading._id,
    sellerId: hawassaSeller._id,
    status: 'CONFIRMED',
    notes: 'Sample confirmed invoice — stock already reflects this deduction.',
    items: [{ productId: cleanser._id, quantity: 10, unitPrice: cleanser.price }],
    paidAmount: 50,
  });

  await upsertPayment({
    invoiceId: confirmedInvoice._id,
    amount: 50,
    paymentMethod: 'BANK_TRANSFER',
    notes: 'First installment',
    recordedBy: hawassaSeller._id,
    daysAgo: 2,
  });

  // Ledger entry documenting the confirmed invoice's stock deduction
  // (the Hawassa cleanser assignment quantity above already reflects it).
  const hawassaCleanserAssignment = assignments['seller.hawassa@inventory.com:SKN-CLN-001'];
  if (hawassaCleanserAssignment) {
    await upsertInventoryTransaction({
      userProductId: hawassaCleanserAssignment._id,
      userId: hawassaSeller._id,
      productId: cleanser._id,
      type: 'SALE',
      beforeQuantity: hawassaCleanserAssignment.quantity + 10,
      changeQuantity: -10,
      afterQuantity: hawassaCleanserAssignment.quantity,
      reason: `Invoice ${confirmedInvoice.invoiceNumber} confirmed`,
      performedBy: hawassaSeller._id,
      daysAgo: 3,
    });
  }

  console.log('\nSeed completed:');
  console.log(`  Admin:  ${admin.email} / ${adminPassword}`);
  for (const def of sellerDefs) {
    console.log(`  Seller: ${def.email} / ${sellerPassword}  (${def.branch.name})`);
  }
  console.log(`  Customer portal: ${customerPortalUser.email} / ${customerPortalPassword}`);
  console.log(`  Countries: ${ethiopia.name}, ${bangladesh.name}`);
  console.log(`  Branches: ${addisBranch.name}, ${hawassaBranch.name}, ${dhakaBranch.name}, ${chittagongBranch.name}`);
  console.log(`  Products: ${Object.keys(products).length}`);
  console.log(`  Inventory assignments: ${assignmentDefs.length}`);
  console.log(`  Historical sales: ${saleDefs.length}`);
  console.log(`  Customers: ${nomiRetail.name}, ${bezaTrading.name}`);
  console.log(`  Invoices: ${draftInvoice.invoiceNumber} (DRAFT), ${confirmedInvoice.invoiceNumber} (CONFIRMED, partially paid)`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectDatabase();
  });
