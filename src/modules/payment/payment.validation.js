import { z } from 'zod';

const uuid = z.string().uuid('Invalid id');

export const createPaymentSchema = z.object({
  invoiceId: uuid,
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'OTHER']).default('CASH'),
  paymentDate: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
});

export const paymentIdParamSchema = z.object({ id: uuid });

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  invoiceId: z.string().uuid().optional(),
});
