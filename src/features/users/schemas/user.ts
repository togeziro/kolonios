import * as z from 'zod';
import { MIN_PASSWORD_LENGTH } from '../api/validation';

export const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  role_group_id: z.string().optional(),
  role: z.string().optional(),
  status: z.string().min(1, 'Please select a status')
});

export type UserFormValues = z.infer<typeof userSchema>;

/**
 * Creation adds an admin-set initial password + confirmation. The account is
 * flagged for forced rotation server-side, so this is a one-time credential.
 */
export const userCreateSchema = userSchema
  .extend({
    password: z.string().optional(),
    confirmPassword: z.string().optional()
  })
  .superRefine((values, ctx) => {
    if (!values.password || values.password.length < MIN_PASSWORD_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      });
    }
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match'
      });
    }
  });

export type UserCreateFormValues = z.infer<typeof userCreateSchema>;
