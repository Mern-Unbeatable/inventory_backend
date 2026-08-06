import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const key = `products/r2-debug-test-${Date.now()}.txt`;
const body = Buffer.from('r2 integration test');

try {
  console.log('Testing R2 PutObject...');
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: 'text/plain',
    })
  );
  console.log('PutObject: SUCCESS, key =', key);

  await client.send(
    new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })
  );
  console.log('HeadObject: SUCCESS — object exists in bucket');

  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })
  );
  console.log('DeleteObject: SUCCESS — cleanup done');
} catch (error) {
  console.error('R2 API test FAILED:', error.name, error.message);
  if (error.$metadata) {
    console.error('HTTP status:', error.$metadata.httpStatusCode);
  }
  process.exit(1);
}
