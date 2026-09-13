import { z } from 'zod';
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

/** Better Auth minimum password length (mirrors profile/password-strength). */
export const MIN_PASSWORD_LENGTH = 8;

const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH);

/**
 * User creation: same fields as update plus an admin-set initial password.
 * The server flags the account for forced rotation, so this password is a
 * one-time credential, never a standing one.
 */
export const userCreateSchema: z.ZodType<UserMutationPayload> = userMutationBase.extend({
  password: passwordSchema
});

/** Admin replacing a user's password (row action, dedicated endpoint). */
export const setUserPasswordSchema = z.object({
  userId: userIdSchema,
  newPassword: passwordSchema
});

export type SetUserPasswordPayload = z.infer<typeof setUserPasswordSchema>;
