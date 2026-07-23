import multer from 'multer';
import path from 'node:path';
import ApiError from '../utils/ApiError.js';
import { uploadConfig } from '../config/upload.js';
import {
  buildUniqueFilename,
  ensureUploadDir,
  isAllowedImage,
  toPublicPath,
} from '../utils/fileStorage.js';

/**
 * Factory for reusable multer upload middleware.
 * @param {object} options
 * @param {string} options.folder - Subfolder under uploads/ (e.g. 'products')
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

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        const dir = ensureUploadDir(folder);
        cb(null, dir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (_req, file, cb) => {
      cb(null, buildUniqueFilename(file.originalname));
    },
  });

  const upload = multer({
    storage,
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
    middleware(req, res, (err) => {
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

      if (req.file) {
        req.uploadedFile = {
          ...req.file,
          publicPath: toPublicPath(folder, req.file.filename),
        };
      }

      return next();
    });
  };
};

/** Convenience middleware for product images */
export const uploadProductImage = createUploadMiddleware({
  folder: uploadConfig.folders.products,
  fieldName: 'image',
  optional: true,
});
