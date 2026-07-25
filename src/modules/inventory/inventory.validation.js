import { z } from 'zod';

const uuid = z.string().uuid('Invalid id');

export const assignProductSchema = z.object({
  userId: uuid,
  productId: uuid,
  quantity: z.coerce.number().int().min(0).default(0),
});

export const updateQuantitySchema = z.object({
  quantity: z.coerce.number().int().min(0, 'Quantity cannot be negative'),
});

export const adjustQuantitySchema = z.object({
  delta: z.coerce.number().int().refine((v) => v !== 0, {
    message: 'Delta must be a non-zero integer',
  }),
});

/** Units sold — decreases own stock for sellers (and admins). */
export const sellProductSchema = z.object({
  quantity: z.coerce.number().int().positive('Sold quantity must be at least 1'),
});

/** Units received (restocked) — increases own stock for sellers (and admins). */
export const receiveStockSchema = z.object({
  quantity: z.coerce.number().int().positive('Received quantity must be at least 1'),
  reason: z.string().max(500).optional(),
});

export const inventoryIdParamSchema = z.object({ id: uuid });

export const userIdParamSchema = z.object({ userId: uuid });

export const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  countryId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  type: z.enum(['RECEIVED', 'SALE', 'ADJUSTMENT', 'MANUAL_UPDATE']).optional(),
});
