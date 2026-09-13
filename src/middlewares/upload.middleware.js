import multer from 'multer';
import ApiError from '../utils/ApiError.js';
import { uploadConfig } from '../config/upload.js';
import {
  isAllowedImage,
  persistUploadedFile,
  usesR2Storage,
} from '../utils/fileStorage.js';

/**
 * Factory for reusable multer upload middleware.
 * @param {object} options
 * @param {string} options.folder - Subfolder under uploads/ or R2 key prefix (e.g. 'products')
 * @param {string} [options.fieldName='image'] - Form field name
 * @param {boolean} [options.optional=true] - Whether file is required
 */
export const createUploadMiddleware = ({
  folder,
  fieldName = 'image',
  optional = true,
} = {}) => {
  if (!folder) {
    throw new Error('createUploadMiddleware requires a folder name');
  }

  // Memory storage works for both local (then written to disk) and R2 uploads.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: uploadConfig.maxFileSize },
    fileFilter: (_req, file, cb) => {
      if (!isAllowedImage(file)) {
        return cb(
          ApiError.badRequest(
            'Invalid image file. Allowed types: jpg, jpeg, png, webp'
          )
        );
      }
      return cb(null, true);
    },
  });

  const middleware = upload.single(fieldName);

  return (req, res, next) => {
    middleware(req, res, async (err) => {
      if (err) {
        if (err instanceof ApiError) return next(err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            const maxMb = Math.round(uploadConfig.maxFileSize / (1024 * 1024));
            return next(
              ApiError.badRequest(`Image must be ${maxMb}MB or smaller`)
            );
          }
          return next(ApiError.badRequest(err.message));
        }
        return next(err);
      }

      if (!optional && !req.file) {
        return next(ApiError.badRequest('Image file is required'));
      }

      if (!req.file) {
        return next();
      }

      try {
        if (process.env.STORAGE_DEBUG === 'true') {
          console.log('[upload.middleware] multer: memoryStorage, hasBuffer:', Boolean(req.file.buffer));
          console.log('[upload.middleware] usesR2Storage:', usesR2Storage());
        }

        const stored = await persistUploadedFile(req.file, folder);

        req.uploadedFile = {
          ...req.file,
          publicPath: stored.publicPath,
          objectKey: stored.objectKey,
          storage: usesR2Storage() ? 'r2' : 'local',
        };

        return next();
      } catch (error) {
        const message = error?.message || 'File upload failed';

        if (/R2 upload failed/i.test(message)) {
          return next(ApiError.internal('Failed to upload file to storage'));
        }

        return next(ApiError.internal('Failed to save uploaded file'));
      }
    });
  };
};

/** Convenience middleware for product images */
export const uploadProductImage = createUploadMiddleware({
  folder: uploadConfig.folders.products,
  fieldName: 'image',
  optional: true,
});

/**
 * Spreadsheet upload for product import (CSV / XLSX). Kept in memory only.
 */
export const uploadProductSpreadsheet = (() => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.max(uploadConfig.maxFileSize, 5 * 1024 * 1024) },
    fileFilter: (_req, file, cb) => {
      const name = String(file.originalname || '').toLowerCase();
      const allowed =
        name.endsWith('.csv') ||
        name.endsWith('.xlsx') ||
        name.endsWith('.json') ||
        file.mimetype === 'text/csv' ||
        file.mimetype === 'application/json' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      if (!allowed) {
        return cb(
          ApiError.badRequest('Invalid file. Allowed types: csv, xlsx, json')
        );
      }
      return cb(null, true);
    },
  }).single('file');

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        if (err instanceof ApiError) return next(err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(ApiError.badRequest('File must be 5MB or smaller'));
          }
          return next(ApiError.badRequest(err.message));
        }
        return next(err);
      }
      if (!req.file) {
        return next(ApiError.badRequest('Spreadsheet file is required'));
      }
      return next();
    });
  };
})();
