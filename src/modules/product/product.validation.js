import { z } from 'zod';

const uuid = z.string().uuid('Invalid id');

const emptyToUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
};

const coerceBoolean = z.preprocess((value) => {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  if (value === '' || value === undefined || value === null) return undefined;
  return value;
}, z.boolean().optional());

export const createProductSchema = z.object({
  title: z.string().min(2).max(200),
  sku: z.string().min(2).max(100),
  description: z.preprocess(
    emptyToUndefined,
    z.string().max(2000).optional().nullable()
  ),
  price: z.coerce.number().min(0).default(0),
  quantity: z.coerce.number().int().min(0).optional().default(0),
  assignUserId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export const updateProductSchema = z.object({
  title: z.preprocess(emptyToUndefined, z.string().min(2).max(200).optional()),
  sku: z.preprocess(emptyToUndefined, z.string().min(2).max(100).optional()),
  description: z.preprocess(
    emptyToUndefined,
    z.string().max(2000).optional().nullable()
  ),
  price: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  quantity: z.coerce.number().int().min(0).optional(),
  removeImage: coerceBoolean,
});

export const productIdParamSchema = z.object({ id: uuid });

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});

export const exportProductsQuerySchema = z.object({
  format: z.enum(["csv", "xlsx", "json"]).default("csv"),
  search: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});

/** Soft validation for one import row (service adds ownership rules). */
export const importProductRowSchema = z.object({
  title: z.string().trim().min(2).max(200),
  sku: z.string().trim().min(2).max(100),
  description: z.preprocess(
    emptyToUndefined,
    z.string().max(2000).optional().nullable()
  ),
  price: z.preprocess(
    emptyToUndefined,
    z.coerce.number().min(0).optional().default(0)
  ),
  quantity: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0).optional().default(0)
  ),
  imageUrl: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(2000).optional().nullable()
  ),
  assignUserId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});
