import { z } from 'zod';

const uuid = z.string().uuid('Invalid id');

export const createProductSchema = z.object({
  title: z.string().min(2).max(200),
  sku: z.string().min(2).max(100),
  description: z.string().max(2000).optional().nullable(),
  price: z.coerce.number().min(0).default(0),
});

export const updateProductSchema = z
  .object({
    title: z.string().min(2).max(200).optional(),
    sku: z.string().min(2).max(100).optional(),
    description: z.string().max(2000).optional().nullable(),
    price: z.coerce.number().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const productIdParamSchema = z.object({ id: uuid });

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});
