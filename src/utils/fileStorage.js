import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { uploadConfig } from '../config/upload.js';

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

export const deleteStoredFile = (publicPath) => {
  const absolute = resolveStoredFilePath(publicPath);
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
