import { z } from 'zod';

const uuid = z.string().uuid('Invalid id');

const emptyToUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
};

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(150),
  email: z.preprocess(
    emptyToUndefined,
    z.string().email('Valid email is required').optional()
  ),
  phone: z.preprocess(emptyToUndefined, z.string().max(30).optional()),
  address: z.preprocess(emptyToUndefined, z.string().max(300).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
});

export const updateCustomerSchema = z
  .object({
    name: z.string().min(2).max(150).optional(),
    email: z.preprocess(
      emptyToUndefined,
      z.string().email('Valid email is required').optional().nullable()
    ),
    phone: z.preprocess(emptyToUndefined, z.string().max(30).optional().nullable()),
    address: z.preprocess(emptyToUndefined, z.string().max(300).optional().nullable()),
    notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional().nullable()),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const createPortalAccountSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const customerIdParamSchema = z.object({ id: uuid });

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export const listCustomerInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
});
