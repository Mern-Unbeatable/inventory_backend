export const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive substring match (Prisma `contains` + `mode: 'insensitive'`). */
export const containsInsensitive = (value) => ({
  $regex: escapeRegex(value),
  $options: 'i',
});
