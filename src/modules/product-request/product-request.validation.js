import { z } from 'zod';

const requestItemSchema = z.object({
  productId: z.string().uuid('Invalid product id'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
});

export const generateProductRequestPdfSchema = z.object({
  items: z
    .array(requestItemSchema)
    .min(1, 'At least one product is required')
    .max(100, 'Too many items in one request'),
});
