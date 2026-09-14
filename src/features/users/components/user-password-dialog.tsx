import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { setUserPasswordMutation } from '../api/mutations';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { assessPasswordStrength } from '@/features/profile/lib/password-strength';
import type { User } from '../api/types';

interface UserPasswordDialogProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Admin replacing a user's password (row action). The new password is a
 * one-time credential: the account is flagged for forced rotation
 * server-side, confining the user to change-password until they set their
 * own. The password never touches the audit trail (after: null).
 */
export function UserPasswordDialog({ user, open, onOpenChange }: UserPasswordDialogProps) {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const replaceMutation = useMutation(
    mergeMutationCallbacks(setUserPasswordMutation, {
      onSuccess: () => {
        toast.success(t('user.passwordReplaced'));
        setNewPassword('');
        setConfirmPassword('');
        setError(null);
        onOpenChange(false);
      },
      onError: () => toast.error(t('user.replaceFailed'))
    })
  );

  const strength = assessPasswordStrength(newPassword);

  function reset() {
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (z.string().min(MIN_PASSWORD_LENGTH).safeParse(newPassword).success === false) {
      setError(t('user.passwordMin'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('user.passwordMismatch'));
      return;
    }

    await replaceMutation.mutateAsync({ userId: user.id, newPassword });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('user.setPassword')}</DialogTitle>
          <DialogDescription>{t('user.setPasswordDescription')}</DialogDescription>
        </DialogHeader>

        <form id='user-password-form' onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='user-new-password'>{t('user.newPassword')}</Label>
            <Input
              id='user-new-password'
              type='password'
              autoComplete='new-password'
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {newPassword.length > 0 && (
              <p className='text-muted-foreground text-xs'>{t(strength.labelKey)}</p>
            )}
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='user-confirm-password'>{t('user.confirmPassword')}</Label>
            <Input
              id='user-confirm-password'
              type='password'
              autoComplete='new-password'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && (
            <p role='alert' className='text-destructive text-sm'>
              {error}
            </p>
          )}

          <p className='text-muted-foreground text-sm'>{t('user.rotationNotice')}</p>
        </form>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type='submit' form='user-password-form' isLoading={replaceMutation.isPending}>
            <Icons.check /> {t('user.setPassword')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
