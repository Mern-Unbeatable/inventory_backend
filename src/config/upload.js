import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Project root: api/ (config lives in api/src/config) */
export const projectRoot = path.resolve(__dirname, '../..');

export const uploadConfig = {
  /** Absolute folder for uploaded files */
  rootDir: path.resolve(projectRoot, process.env.UPLOAD_DIR || 'uploads'),
  /** URL path prefix served by Express static */
  publicPath: process.env.UPLOAD_PUBLIC_PATH || '/uploads',
  /** Max upload size in bytes (default 2MB) */
  maxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE) || 2 * 1024 * 1024,
  allowedMimeTypes: (
    process.env.UPLOAD_ALLOWED_MIME_TYPES ||
    'image/jpeg,image/png,image/webp'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  /** Subfolder names for entity-specific uploads */
  folders: {
    products: 'products',
  },
};
