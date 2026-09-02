import { z } from "zod";

const uuid = z.string().uuid("Invalid id");

/** QR identifier embedded in the printed code URL, e.g. /verify/ABC12345 */
const qrId = z
  .string()
  .trim()
  .min(4, "QR ID must be at least 4 characters")
  .max(64, "QR ID must be at most 64 characters")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'QR ID may only contain letters, numbers, "-" and "_"',
  );

export const createVerificationSchema = z.object({
  qrId,
  productId: uuid,
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});

export const updateVerificationSchema = z
  .object({
    productId: uuid.optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const verificationIdParamSchema = z.object({ id: uuid });

export const bulkVerificationDeleteSchema = z.object({
  ids: z
    .array(uuid)
    .min(1, "At least one QR mapping is required")
    .max(100, "Too many QR mappings selected"),
});

export const qrIdParamSchema = z.object({ qrId });

export const listVerificationsQuerySchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
});
