import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import env from '../config/env.js';

let client = null;

const normalizeBaseUrl = (url) => url.replace(/\/$/, '');

/**
 * True when all required R2 environment variables are set (including public URL).
 */
export const isR2StorageEnabled = () => {
  const { bucket, accountId, accessKeyId, secretAccessKey, endpoint, publicUrl } =
    env.r2;
  return Boolean(
    bucket && accountId && accessKeyId && secretAccessKey && endpoint && publicUrl
  );
};

const getR2Client = () => {
  if (!isR2StorageEnabled()) {
    throw new Error('Cloudflare R2 is not fully configured');
  }

  if (!client) {
    client = new S3Client({
      region: env.r2.region,
      endpoint: env.r2.endpoint,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });
  }

  return client;
};

/**
 * Build a browser-accessible URL for an object key.
 */
export const buildR2PublicUrl = (objectKey) => {
  const base = normalizeBaseUrl(env.r2.publicUrl);
  const key = objectKey.replace(/^\/+/, '');
  return `${base}/${key}`;
};

/**
 * Extract the R2 object key from a stored public URL.
 */
export const extractR2ObjectKey = (publicUrl) => {
  if (!publicUrl || typeof publicUrl !== 'string') return null;

  const base = normalizeBaseUrl(env.r2.publicUrl);
  const normalized = publicUrl.replace(/\\/g, '/');

  if (!normalized.startsWith(`${base}/`)) return null;

  return normalized.slice(base.length + 1);
};

/**
 * Upload a file buffer to Cloudflare R2.
 * @returns {Promise<string>} Public URL of the uploaded object
 */
export const uploadToR2 = async ({ buffer, objectKey, contentType }) => {
  if (!buffer?.length) {
    throw new Error('Cannot upload an empty file to R2');
  }

  try {
    const s3 = getR2Client();

    await s3.send(
      new PutObjectCommand({
        Bucket: env.r2.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return buildR2PublicUrl(objectKey);
  } catch (error) {
    const message = error?.name || error?.message || 'Unknown R2 upload error';
    const wrapped = new Error(`R2 upload failed: ${message}`);
    wrapped.cause = error;
    throw wrapped;
  }
};

/**
 * Delete an object from Cloudflare R2 by public URL or object key.
 */
export const deleteFromR2 = async (publicUrlOrKey) => {
  if (!isR2StorageEnabled() || !publicUrlOrKey) return false;

  const objectKey =
    extractR2ObjectKey(publicUrlOrKey) || publicUrlOrKey.replace(/^\/+/, '');

  if (!objectKey) return false;

  try {
    const s3 = getR2Client();

    await s3.send(
      new DeleteObjectCommand({
        Bucket: env.r2.bucket,
        Key: objectKey,
      })
    );

    return true;
  } catch {
    return false;
  }
};
