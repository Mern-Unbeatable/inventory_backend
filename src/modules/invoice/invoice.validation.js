import { z } from 'zod';

const uuid = z.string().uuid('Invalid id');

const emptyToUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
};

const invoiceItemInput = z.object({
  productId: uuid,
  quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
});

const noDuplicateProducts = (items) => {
  const ids = items.map((item) => item.productId);
  return new Set(ids).size === ids.length;
};

export const createInvoiceSchema = z
  .object({
    customerId: uuid,
    sellerId: uuid.optional(),
    items: z.array(invoiceItemInput).min(1, 'At least one item is required'),
    notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  })
  .refine((data) => noDuplicateProducts(data.items), {
    message: 'Duplicate products are not allowed on an invoice',
    path: ['items'],
  });

export const updateInvoiceSchema = z
  .object({
    items: z.array(invoiceItemInput).min(1, 'At least one item is required').optional(),
    notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional().nullable()),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })
  .refine((data) => !data.items || noDuplicateProducts(data.items), {
    message: 'Duplicate products are not allowed on an invoice',
    path: ['items'],
  });

export const invoiceIdParamSchema = z.object({ id: uuid });

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customerId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).optional(),
  search: z.string().optional(),
});
