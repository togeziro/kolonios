'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/components/ui/tanstack-form';
import { PasswordField } from '@/components/forms/fields/password-field';
import { authClient } from '@/lib/auth/auth-client';
import { useRouter } from '@tanstack/react-router';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

const formSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' }),
  remember: z.boolean()
});

export default function UserAuthForm() {
  const [loading, startTransition] = useTransition();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
      remember: false
    },
    validators: {
      onSubmit: formSchema
    },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const { error } = await authClient.signIn.email({
          email: value.email,
          password: value.password,
          rememberMe: value.remember
        });
        if (error) {
          toast.error(error.message || 'Sign in failed');
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
              autoComplete='current-password'
            />
          )}
        />
        <form.AppField
          name='remember'
          children={(field) => (
            <div className='flex items-center gap-2'>
              <Checkbox
                id={field.name}
                checked={!!field.state.value}
                onCheckedChange={(checked) => field.handleChange(!!checked)}
              />
              <label
                htmlFor={field.name}
                className='text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
              >
                Remember me for 30 days
              </label>
            </div>
          )}
        />
        <Button disabled={loading} className='ml-auto w-full' type='submit'>
          Login
        </Button>
      </form.Form>
    </form.AppForm>
  );
}
