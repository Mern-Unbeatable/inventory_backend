import { randomUUID } from 'node:crypto';

/** Shared UUID primary key (string) — keeps frontend Zod UUID contracts intact. */
export const uuidPrimaryKey = {
  type: String,
  default: () => randomUUID(),
};

/**
 * Expose `id` instead of `_id` in API JSON (Prisma-compatible).
 */
export const applyIdTransform = (schema) => {
  const transform = (_doc, ret) => {
    if (ret._id !== undefined) {
      ret.id = ret._id;
      delete ret._id;
    }
    delete ret.__v;
    return ret;
  };

  schema.set('toJSON', { virtuals: true, versionKey: false, transform });
  schema.set('toObject', { virtuals: true, versionKey: false, transform });
};

/** Serialize a Mongoose document or array for API responses. */
export const toApi = (value) => {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => toApi(item));
  if (typeof value.toJSON === 'function') return value.toJSON();
  return value;
};
