import { ZodSchema, ZodError } from 'zod';

export class ValidationError extends Error {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(zodError: ZodError) {
    const errors = zodError.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    super(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error);
  }
  return result.data;
}

export * from './schemas';
