import { z } from 'zod';

export const SigninSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(100),
  token: z.string().min(1)
});

export const SignupSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters'),
  token: z.string().min(1)
});

export const SlugSchema = z.object({
  slug: z.string().min(1).max(200)
});

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0)
});

export type SigninInput = z.infer<typeof SigninSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
