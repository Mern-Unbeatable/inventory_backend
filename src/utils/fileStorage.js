import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { uploadConfig } from '../config/upload.js';
import env from '../config/env.js';
import {
  deleteFromR2,
  extractR2ObjectKey,
  isR2StorageEnabled,
  uploadToR2,
} from './r2Storage.js';

export const usesR2Storage = () =>
  env.storageProvider === 'r2' && isR2StorageEnabled();

export const ensureUploadDir = (subdir = '') => {
  const dir = path.join(uploadConfig.rootDir, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const buildUniqueFilename = (originalName) => {
  const ext = path.extname(originalName || '').toLowerCase();
  return `${randomUUID()}${ext}`;
};

/**
 * Build a unique object key for cloud storage (e.g. products/<uuid>.png).
 */
export const buildObjectKey = (subdir, filename) =>
  `${subdir}/${filename}`.replace(/\\/g, '/');

/**
 * Convert a stored absolute or relative disk path into a public URL path.
 * Stored values look like: /uploads/products/<file>
 */
export const toPublicPath = (subdir, filename) => {
  const base = uploadConfig.publicPath.replace(/\/$/, '');
  return `${base}/${subdir}/${filename}`.replace(/\\/g, '/');
};

/**
 * Resolve a public path (/uploads/...) to an absolute disk path for deletion.
 * Returns null if the path is outside the uploads root (safety).
 */
export const resolveStoredFilePath = (publicPath) => {
  if (!publicPath || typeof publicPath !== 'string') return null;

  const normalizedPublic = publicPath.replace(/\\/g, '/');
  const prefix = uploadConfig.publicPath.replace(/\/$/, '');
  if (!normalizedPublic.startsWith(`${prefix}/`) && normalizedPublic !== prefix) {
    return null;
  }

  const relative = normalizedPublic.slice(prefix.length).replace(/^\//, '');
  const absolute = path.resolve(uploadConfig.rootDir, relative);
  const root = path.resolve(uploadConfig.rootDir);

  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    return null;
  }

  return absolute;
};

/**
 * Delete a stored file from R2 or local disk (best-effort).
 * Supports legacy `/uploads/...` paths and R2 public URLs.
 */
export const deleteStoredFile = async (publicPathOrUrl) => {
  if (!publicPathOrUrl) return false;

  if (usesR2Storage() && extractR2ObjectKey(publicPathOrUrl)) {
    return deleteFromR2(publicPathOrUrl);
  }

  const absolute = resolveStoredFilePath(publicPathOrUrl);
  if (!absolute) return false;

  try {
    if (fs.existsSync(absolute)) {
      fs.unlinkSync(absolute);
      return true;
    }
  } catch {
    // Best-effort cleanup — do not fail the request if unlink fails
  }
  return false;
};

export const isAllowedImage = (file) => {
  if (!file) return false;
  const mimeOk = uploadConfig.allowedMimeTypes.includes(file.mimetype);
  const ext = path.extname(file.originalname || '').toLowerCase();
  const extOk = uploadConfig.allowedExtensions.includes(ext);
  return mimeOk && extOk;
};

/**
 * Persist an uploaded multer file to the configured storage backend.
 * @returns {Promise<{ publicPath: string, objectKey?: string }>}
 */
export const persistUploadedFile = async (file, folder) => {
  const filename = buildUniqueFilename(file.originalname);
  const useR2 = usesR2Storage();

  if (process.env.STORAGE_DEBUG === 'true') {
    console.log('[persistUploadedFile] storageProvider:', env.storageProvider);
    console.log('[persistUploadedFile] usesR2Storage:', useR2);
    console.log('[persistUploadedFile] file.buffer bytes:', file.buffer?.length ?? 0);
  }

  if (useR2) {
    const objectKey = buildObjectKey(folder, filename);

    if (process.env.STORAGE_DEBUG === 'true') {
      console.log('[persistUploadedFile] → uploadToR2, key:', objectKey);
    }

    const publicPath = await uploadToR2({
      buffer: file.buffer,
      objectKey,
      contentType: file.mimetype,
    });

    if (process.env.STORAGE_DEBUG === 'true') {
      console.log('[persistUploadedFile] Generated imageUrl:', publicPath);
    }

    return { publicPath, objectKey };
  }

  if (process.env.STORAGE_DEBUG === 'true') {
    console.log('[persistUploadedFile] → local disk write');
  }

  const dir = ensureUploadDir(folder);
  const absolutePath = path.join(dir, filename);
  await fs.promises.writeFile(absolutePath, file.buffer);

  const publicPath = toPublicPath(folder, filename);

  if (process.env.STORAGE_DEBUG === 'true') {
    console.log('[persistUploadedFile] Generated imageUrl:', publicPath);
  }

  return {
    publicPath,
    objectKey: null,
  };
};
