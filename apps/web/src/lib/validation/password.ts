import { z } from 'zod';

/** Mirrors the server's policy (`PASSWORD_MIN_LENGTH`/`PASSWORD_MAX_LENGTH`) for inline errors. */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters');
