import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import type { UserFilters, UserMutationPayload } from './types';

export const userFiltersSchema: z.ZodType<UserFilters> = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  roles: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  status: z.string().optional()
});

export const userIdSchema = z.string();

const userMutationBase = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().optional(),
  role_group_id: z.string().optional(),
  status: z.string().min(1)
});

export const userMutationSchema: z.ZodType<UserMutationPayload> = userMutationBase;

const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH);

/**
 * Blank means "generate for me"; a provided value must meet the minimum.
 * (The DB re-checks and throws WEAK_PASSWORD — this is the early RPC gate.)
 */
const optionalPasswordSchema = z
  .string()
  .optional()
  .refine((v) => v === undefined || v.trim() === '' || v.length >= MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  });

/**
 * User creation: same fields as update plus an optional admin-set initial
 * password. Blank means "generate for me" — the server returns the
 * one-time credential ONCE in the create response (never stored, never
 * audited); the account is flagged for forced rotation either way.
 */
export const userCreateSchema: z.ZodType<UserMutationPayload> = userMutationBase.extend({
  password: optionalPasswordSchema
});

/** Admin replacing a user's password (row action, dedicated endpoint). */
export const setUserPasswordSchema = z.object({
  userId: userIdSchema,
  newPassword: passwordSchema
});

export type SetUserPasswordPayload = z.infer<typeof setUserPasswordSchema>;
