import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const updateProfileSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
    email: z.string().email('Valid email is required').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
