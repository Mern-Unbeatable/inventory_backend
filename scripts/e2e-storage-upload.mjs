/**
 * End-to-end storage upload test (no HTTP server required).
 * Usage:
 *   node scripts/e2e-storage-upload.mjs
 *   R2_PUBLIC_URL=https://pub-xxxx.r2.dev node scripts/e2e-storage-upload.mjs
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.R2_PUBLIC_URL) {
  process.env.R2_PUBLIC_URL = 'https://e2e-test.invalid';
  console.warn(
    'R2_PUBLIC_URL not set — using placeholder for flow test. Set a real public URL for browser access.'
  );
}

const { logStorageConfig } = await import('../src/utils/logStorageConfig.js');
const { persistUploadedFile, usesR2Storage, deleteStoredFile } = await import(
  '../src/utils/fileStorage.js'
);
const { uploadConfig } = await import('../src/config/upload.js');

logStorageConfig();

console.log('\n=== Step 2–3: persistUploadedFile (multer-equivalent buffer) ===');
console.log('usesR2Storage():', usesR2Storage());
console.log('Multer mode: memoryStorage (buffer upload)');

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const fakeFile = {
  originalname: 'e2e-test.png',
  mimetype: 'image/png',
  buffer: pngBuffer,
};

const stored = await persistUploadedFile(fakeFile, uploadConfig.folders.products);

console.log('Generated imageUrl:', stored.publicPath);
console.log('Object key:', stored.objectKey);
console.log('Storage path used:', usesR2Storage() ? 'R2' : 'LOCAL');

const localDir = path.join(uploadConfig.rootDir, uploadConfig.folders.products);
const localFiles = fs.existsSync(localDir)
  ? fs.readdirSync(localDir).filter((f) => f.includes('e2e'))
  : [];

console.log('\n=== Step 6: Verification ===');
console.log('Local uploads/products e2e files:', localFiles.length);

if (usesR2Storage()) {
  const client = new S3Client({
    region: process.env.R2_REGION || 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  await client.send(
    new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: stored.objectKey,
    })
  );
  console.log('R2 HeadObject: object exists in bucket ✔');

  const deleted = await deleteStoredFile(stored.publicPath);
  console.log('deleteStoredFile:', deleted ? 'SUCCESS ✔' : 'FAILED');

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: stored.objectKey,
      })
    );
    console.error('R2 object still exists after delete');
    process.exit(1);
  } catch {
    console.log('R2 object removed after delete ✔');
  }

  if (stored.publicPath.startsWith('http')) {
    console.log('imageUrl format: R2 public URL ✔');
  } else {
    console.error('imageUrl format: unexpected', stored.publicPath);
    process.exit(1);
  }
} else {
  console.error('FAILED: R2 was not selected — check R2_PUBLIC_URL in .env');
  process.exit(1);
}

console.log('\nE2E storage test passed.');
