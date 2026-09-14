import * as z from 'zod';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

export const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  role_group_id: z.string().optional(),
  role: z.string().optional(),
  status: z.string().min(1, 'Please select a status')
});

export type UserFormValues = z.infer<typeof userSchema>;

/**
 * Creation adds an optional admin-set initial password + confirmation.
 * Both blank means "generate for me" (the server returns the one-time
 * credential once). A provided password must meet the minimum and match.
 * The account is flagged for forced rotation server-side either way.
 */
export const userCreateSchema = userSchema
  .extend({
    password: z.string().optional(),
    confirmPassword: z.string().optional()
  })
  .superRefine((values, ctx) => {
    const provided = values.password?.trim() || values.confirmPassword?.trim();
    if (!provided) return;
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
