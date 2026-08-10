'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/components/ui/tanstack-form';
import { PasswordField } from '@/components/forms/fields/password-field';
import { authClient } from '@/lib/auth/auth-client';
import { resolveHomePath } from '@/lib/shells/resolve';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useTransition, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function UserAuthForm() {
  const { t } = useTranslation();
  const [loading, startTransition] = useTransition();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
      remember: false
    },
    onSubmit: ({ value }) => {
      const email = value.email || emailRef.current?.value || '';
      const password = value.password || passwordRef.current?.value || '';
      if (!email || !password) {
        toast.error(t('auth.validationFailed'));
        return;
      }
      startTransition(async () => {
        const { error } = await authClient.signIn.email({
          email,
          password,
          rememberMe: value.remember
        });
        if (error) {
          toast.error(error.message || t('auth.signInFailed'));
        } else {
          await queryClient.invalidateQueries({
            queryKey: ['settings', 'locale']
          });
          const { data: sessionData } = await authClient.getSession();
          const home = resolveHomePath(sessionData?.user?.role) as
            | '/dashboard/overview'
            | '/portal';
          router.navigate({ to: home });
        }
      });
    }
  });

  // Chrome autofill and password managers write values straight into the DOM
  // without firing React onChange events, so a controlled input misses them.
  // Pull any pre-filled values into the form state shortly after mount so a
  // saved-credential login works on the first click.
  useEffect(() => {
    const syncAutofill = () => {
      const email = emailRef.current?.value ?? '';
      const password = passwordRef.current?.value ?? '';
      if (email && !form.state.values.email) form.setFieldValue('email', email);
      if (password && !form.state.values.password) form.setFieldValue('password', password);
    };
    const first = window.setTimeout(syncAutofill, 150);
    const second = window.setTimeout(syncAutofill, 800);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [form]);

  return (
    <form.AppForm>
      <form.Form className='w-full space-y-4'>
        <form.AppField
          name='remember'
          children={(field) => (
            <div className='flex items-center gap-2'>
              <Checkbox
                id='remember'
                name='remember'
                checked={!!field.state.value}
                onCheckedChange={(checked) => field.handleChange(!!checked)}
              />
              <label
                htmlFor='remember'
                className='text-sm font-normal leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
              >
                {t('auth.rememberMe30')}
              </label>
            </div>
          )}
        />
        <form.AppField
          name='email'
          children={(field) => (
            <field.FieldSet>
              <field.Field>
                <field.FieldLabel htmlFor='email'>{t('auth.emailAddress')}</field.FieldLabel>
                <Input
                  id='email'
                  ref={emailRef}
                  name='email'
                  type='email'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  autoComplete='email'
                  disabled={loading}
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
              label={t('auth.password')}
              loading={loading}
              autoComplete='current-password'
              inputRef={passwordRef}
            />
          )}
        />
        <Button disabled={loading} className='ml-auto w-full' type='submit'>
          {t('auth.login')}
        </Button>
      </form.Form>
    </form.AppForm>
  );
}
