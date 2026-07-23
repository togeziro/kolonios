'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/components/ui/tanstack-form';
import { PasswordField } from '@/components/forms/fields/password-field';
import { authClient } from '@/lib/auth/auth-client';
import { useRouter } from '@tanstack/react-router';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

const formSchema = z
  .object({
    name: z.string().min(1, { message: 'Name is required' }),
    email: z.string().email({ message: 'Enter a valid email address' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z.string().min(6, { message: 'Confirm password is required' })
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export default function RegisterForm() {
  const [loading, startTransition] = useTransition();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useAppForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    },
    validators: {
      onSubmit: formSchema
    },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const { error } = await authClient.signUp.email({
          email: value.email,
          password: value.password,
          name: value.name
        });
        if (error) {
          toast.error(error.message || 'Registration failed');
        } else {
          router.navigate({ to: '/dashboard/overview' });
        }
      });
    }
  });

  return (
    <form.AppForm>
      <form.Form className='w-full space-y-4'>
        <form.AppField
          name='name'
          children={(field) => (
            <field.FieldSet>
              <field.Field>
                <field.FieldLabel htmlFor={field.name}>Name</field.FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type='text'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder='John Doe'
                  disabled={loading}
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                />
              </field.Field>
              <field.FieldError />
            </field.FieldSet>
          )}
        />
        <form.AppField
          name='email'
          children={(field) => (
            <field.FieldSet>
              <field.Field>
                <field.FieldLabel htmlFor={field.name}>Email Address</field.FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type='email'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder='you@example.com'
                  autoComplete='email'
                  disabled={loading}
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                />
              </field.Field>
              <field.FieldError />
            </field.FieldSet>
          )}
        />
        <form.AppField
          name='password'
          children={(field) => (
            <PasswordField
              field={field}
              show={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
              label='Password'
              loading={loading}
              autoComplete='new-password'
            />
          )}
        />
        <form.AppField
          name='confirmPassword'
          children={(field) => (
            <PasswordField
              field={field}
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
              label='Confirm Password'
              loading={loading}
              autoComplete='new-password'
            />
          )}
        />
        <Button disabled={loading} className='ml-auto w-full' type='submit'>
          Create Account
        </Button>
      </form.Form>
    </form.AppForm>
  );
}
