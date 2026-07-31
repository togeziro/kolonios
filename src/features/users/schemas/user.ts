import * as z from 'zod';

export const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  role_group_id: z.string().optional(),
  role: z.string().optional(),
  status: z.string().min(1, 'Please select a status')
});

export type UserFormValues = z.infer<typeof userSchema>;
