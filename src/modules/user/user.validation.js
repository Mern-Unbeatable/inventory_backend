import { z } from 'zod';

const uuid = z.string().uuid('Invalid id');

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'SELLER', 'CUSTOMER']).default('SELLER'),
  branchId: z.string().uuid('Invalid branch id').nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'SELLER' && !data.branchId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['branchId'],
      message: 'Sellers must be assigned to a branch',
    });
  }
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'SELLER', 'CUSTOMER']).optional(),
  branchId: z.string().uuid().nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

export const userIdParamSchema = z.object({
  id: uuid,
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['ADMIN', 'SELLER', 'CUSTOMER']).optional(),
  branchId: z.string().uuid().optional(),
  countryId: z.string().uuid().optional(),
  search: z.string().optional(),
});
