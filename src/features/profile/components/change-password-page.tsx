import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import { assessPasswordStrength, type PasswordTier } from '../lib/password-strength';

const tierStyles: Record<PasswordTier, { bar: string; text: string }> = {
  weak: { bar: 'bg-red-500', text: 'text-red-400 dark:text-red-500' },
  fair: { bar: 'bg-amber-500', text: 'text-amber-500 dark:text-amber-400' },
  good: { bar: 'bg-lime-500', text: 'text-lime-600 dark:text-lime-400' },
  strong: {
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400'
  }
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  describedBy
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  describedBy?: string;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className='space-y-1.5'>
      <label htmlFor={id} className='dark:text-zinc-100 block text-xs font-semibold'>
        {label}
      </label>
      <div className='relative'>
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className='dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 h-12 rounded-xl px-4 pr-12 text-sm'
        />
        <button
          type='button'
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('changePassword.hidePassword') : t('changePassword.showPassword')}
          aria-pressed={visible}
          className='text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5'
        >
          {visible ? (
            <Icons.eyeOff className='h-[18px] w-[18px]' />
          ) : (
            <Icons.eye className='h-[18px] w-[18px]' />
          )}
        </button>
      </div>
    </div>
  );
}

function StrengthMeter({ value }: { value: string }) {
  const { t } = useTranslation();
  const strength = assessPasswordStrength(value);
  const fillCount = value.length > 0 ? Math.max(1, strength.score) : 0;
  const style = tierStyles[strength.tier];

  return (
    <div className='pt-2'>
      <div className='flex items-center gap-3'>
        <div data-testid='strength-meter' className='flex flex-1 gap-1.5'>
          {[0, 1, 2, 3].map((segment) => (
            <span
              key={segment}
              className={`h-1 flex-1 rounded-full ${
                segment < fillCount ? style.bar : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>
        {value.length > 0 && (
          <span data-testid='strength-label' className={`text-xs font-medium ${style.text}`}>
            {t(strength.labelKey)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('changePassword.errors.required'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('changePassword.errors.mismatch'));
      return;
    }
    if (assessPasswordStrength(newPassword).tier === 'weak') {
      setError(t('changePassword.errors.weak'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: apiError } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true
      });
      if (apiError) {
        const unauthorized =
          apiError.status === 401 || /invalid|incorrect|wrong/i.test(apiError.message ?? '');
        setError(
          unauthorized
            ? t('changePassword.errors.wrongCurrent')
            : t('changePassword.errors.generic')
        );
        return;
      }
      toast.success(t('changePassword.successToast'));
      navigate({ to: '/dashboard/profile' });
    } catch {
      setError(t('changePassword.errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className='flex min-h-screen flex-col'>
      <header className='dark:bg-zinc-950 dark:border-zinc-800 sticky top-0 z-50 border-b bg-white'>
        <div className='flex items-center gap-3 px-4 py-3'>
          <button
            type='button'
            onClick={() => navigate({ to: '..' })}
            className='dark:hover:bg-zinc-900 -ml-2 rounded-full p-2 transition-colors hover:bg-zinc-100'
          >
            <Icons.chevronLeft className='h-5 w-5' />
          </button>
          <h1 className='dark:text-zinc-100 text-lg font-bold tracking-tight'>
            {t('changePassword.title')}
          </h1>
        </div>
      </header>

      <main className='flex-1 space-y-6 px-4 py-6'>
        <div className='dark:border-zinc-800/50 dark:bg-zinc-900 flex items-start gap-4 rounded-2xl border p-5'>
          <span className='dark:bg-zinc-800 dark:text-zinc-300 shrink-0 rounded-full p-2'>
            <Icons.lock className='h-5 w-5' />
          </span>
          <p className='text-muted-foreground dark:text-zinc-400 text-sm leading-relaxed'>
            {t('changePassword.securityHint')}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className='dark:border-zinc-800/50 dark:bg-zinc-900 space-y-5 rounded-2xl border p-5'>
            <PasswordField
              id='current-password'
              label={t('changePassword.fields.current')}
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete='current-password'
            />

            <div>
              <PasswordField
                id='new-password'
                label={t('changePassword.fields.new')}
                value={newPassword}
                onChange={setNewPassword}
                autoComplete='new-password'
              />
              <StrengthMeter value={newPassword} />
            </div>

            <PasswordField
              id='confirm-password'
              label={t('changePassword.fields.confirm')}
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete='new-password'
            />

            {error && (
              <p role='alert' className='text-destructive text-sm'>
                {error}
              </p>
            )}

            <Button
              type='submit'
              disabled={isSubmitting}
              className='h-12 w-full rounded-xl text-sm font-semibold'
            >
              {isSubmitting ? (
                <>
                  <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                  {t('changePassword.submitting')}
                </>
              ) : (
                t('changePassword.submit')
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
