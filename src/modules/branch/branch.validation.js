import { z } from "zod";

const uuid = z.string().uuid("Invalid id");

export const createCountrySchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(10).optional().nullable(),
});

export const updateCountrySchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    code: z.string().min(2).max(10).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const countryIdParamSchema = z.object({ id: uuid });

export const createBranchSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(1).max(50).optional().nullable(),
  countryId: uuid,
});

export const updateBranchSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    code: z.string().min(1).max(50).optional().nullable(),
    countryId: uuid.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const branchIdParamSchema = z.object({ id: uuid });

export const bulkBranchDeleteSchema = z.object({
  ids: z
    .array(uuid)
    .min(1, "At least one branch is required")
    .max(100, "Too many branches selected"),
});

export const listBranchesQuerySchema = z.object({
  countryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
