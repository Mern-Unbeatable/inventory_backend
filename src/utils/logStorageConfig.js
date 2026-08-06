import env from '../config/env.js';
import { isR2StorageEnabled } from './r2Storage.js';
import { usesR2Storage } from './fileStorage.js';

const status = (value) => (value ? '✔ Loaded' : '❌ Missing');

/**
 * Print storage configuration at startup (secrets are never logged).
 */
export const logStorageConfig = () => {
  const providerEnv = process.env.STORAGE_PROVIDER || '(not set — auto-detect)';

  console.log('--- Storage configuration ---');
  console.log(`Storage Provider : ${env.storageProvider}`);
  console.log(`STORAGE_PROVIDER : ${providerEnv}`);
  console.log(`usesR2Storage()  : ${usesR2Storage()}`);
  console.log(`isR2Enabled()    : ${isR2StorageEnabled()}`);
  console.log(`Bucket           : ${status(env.r2.bucket)}`);
  console.log(`Account ID       : ${status(env.r2.accountId)}`);
  console.log(`Access Key       : ${status(env.r2.accessKeyId)}`);
  console.log(`Secret Key       : ${status(env.r2.secretAccessKey)}`);
  console.log(`Endpoint         : ${status(env.r2.endpoint)}`);
  console.log(`Public URL       : ${status(env.r2.publicUrl)}`);
  console.log(`Region           : ${env.r2.region}`);

  if (
    env.r2.bucket &&
    env.r2.accessKeyId &&
    env.r2.endpoint &&
    !env.r2.publicUrl
  ) {
    console.warn(
      '⚠️  R2 credentials are set but R2_PUBLIC_URL is missing — uploads will use LOCAL storage.'
    );
    console.warn(
      '   Set R2_PUBLIC_URL in .env to your R2 public bucket URL (e.g. https://pub-xxxx.r2.dev).'
    );
  }

  console.log('-----------------------------');
};
