/**
 * API-layer product create with image — verifies imageUrl in response.
 * Requires MongoDB connection.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.R2_PUBLIC_URL) {
  process.env.R2_PUBLIC_URL = 'https://e2e-test.invalid';
  console.warn('Using placeholder R2_PUBLIC_URL for API E2E test.');
}

const { connectDatabase, disconnectDatabase } = await import('../src/config/mongoose.js');
const productService = (await import('../src/modules/product/product.service.js')).default;
const { User } = await import('../src/models/User.js');
const { Product } = await import('../src/models/Product.js');
const { usesR2Storage, persistUploadedFile, deleteStoredFile } = await import(
  '../src/utils/fileStorage.js'
);
const { uploadConfig } = await import('../src/config/upload.js');

await connectDatabase();

const admin = await User.findOne({ role: 'ADMIN' });
if (!admin) {
  console.error('No admin user — run npm run seed first');
  process.exit(1);
}

const sku = `R2-E2E-${Date.now()}`;
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

console.log('usesR2Storage():', usesR2Storage());

const stored = await persistUploadedFile(
  { originalname: 'api-e2e.png', mimetype: 'image/png', buffer: pngBuffer },
  uploadConfig.folders.products
);

console.log('Generated imageUrl (before DB save):', stored.publicPath);

const created = await productService.create(
  {
    title: 'R2 E2E Test Product',
    sku,
    description: 'Auto test',
    price: 1,
    quantity: 0,
  },
  { publicPath: stored.publicPath },
  { id: admin._id, role: 'ADMIN' }
);

console.log('API response imageUrl:', created.imageUrl);

if (!created.imageUrl?.startsWith('http')) {
  console.error('FAILED: imageUrl is not an R2 public URL');
  process.exit(1);
}

await deleteStoredFile(created.imageUrl);
await Product.deleteOne({ _id: created.id });

console.log('API E2E test passed.');

await disconnectDatabase();
