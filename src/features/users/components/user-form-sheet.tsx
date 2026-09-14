import { useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createUserMutation, updateUserMutation } from '../api/mutations';
import type { User } from '../api/types';
import { mergeMutationCallbacks } from '@/lib/mutation-options';
import { toast } from 'sonner';
import * as z from 'zod';
import { userSchema, userCreateSchema, type UserFormValues } from '../schemas/user';
import type { UserCreateFormValues } from '../schemas/user';
import { STATUS_OPTIONS } from './users-table/options';
import { roleGroupsQueryOptions } from '@/features/role-groups/api/queries';

const NO_ROLE_GROUP = 'none';

interface UserFormSheetProps {
  user?: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFormSheet({ user, open, onOpenChange }: UserFormSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!user;

  const { data: rgData } = useQuery(roleGroupsQueryOptions());
  const roleGroupsList =
    (rgData as { role_groups?: { id: string; name: string }[] })?.role_groups ?? [];
  const roleGroupOptions = [
    { value: NO_ROLE_GROUP, label: t('user.noRoleGroup') },
    ...roleGroupsList.map((rg) => ({ value: rg.id, label: rg.name }))
  ];

  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const createMutation = useMutation(
    mergeMutationCallbacks(createUserMutation, {
      // The server returns generatedPassword ONCE when the admin left the
      // password blank — show it in a copy dialog instead of closing, so the
      // one-time credential can be shared out-of-band before it vanishes.
      onSuccess: (data) => {
        const generated = (data as { generatedPassword?: string } | undefined)?.generatedPassword;
        if (generated) {
          setGeneratedPassword(generated);
        } else {
          toast.success(t('user.created'));
          onOpenChange(false);
        }
        form.reset();
      },
      onError: () => toast.error(t('user.createFailed'))
    })
  );

  const updateMutation = useMutation(
    mergeMutationCallbacks(updateUserMutation, {
      onSuccess: () => {
        toast.success(t('user.updated'));
        onOpenChange(false);
      },
      onError: () => toast.error(t('user.updateFailed'))
    })
  );

  const form = useAppForm({
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role_group_id: user?.role_group_id ?? 'none',
      role: user?.role ?? '',
      status: user?.status ?? 'Active',
      ...(isEdit ? {} : { password: '', confirmPassword: '' })
    } as UserFormValues,
    validators: {
      onSubmit: isEdit ? userSchema : userCreateSchema
    },
    onSubmit: async ({ value }) => {
      const payload = {
        ...value,
        role_group_id: value.role_group_id === 'none' ? undefined : value.role_group_id
      };
      if (isEdit) {
        const {
          password: _pw,
          confirmPassword: _cpw,
          ...updateValues
        } = payload as Record<string, unknown>;
        await updateMutation.mutateAsync({
          id: user.id,
          values: updateValues as UserFormValues
        });
      } else {
        const { confirmPassword: _cpw, ...createValues } = payload as Record<string, unknown>;
        await createMutation.mutateAsync(createValues as UserFormValues);
      }
    }
  });

  const { FormTextField, FormSelectField } = useFormFields<
    UserFormValues & Partial<Pick<UserCreateFormValues, 'password' | 'confirmPassword'>>
  >();

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function copyGenerated() {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      toast.success(t('user.passwordCopied'));
    } catch {
      toast.error(t('user.passwordCopyFailed'));
    }
  }

  function closeSheet(next: boolean) {
    // The generated password is single-use: confirm the admin captured it
    // before the dialog (and the secret) may go away.
    if (!next) setGeneratedPassword(null);
    onOpenChange(next);
  }

  return (
    <>
      <Dialog
        open={generatedPassword !== null}
        onOpenChange={(next) => {
          if (!next) {
            toast.success(t('user.created'));
            setGeneratedPassword(null);
            onOpenChange(false);
          }
        }}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('user.generatedPasswordTitle')}</DialogTitle>
            <DialogDescription>{t('user.generatedPasswordDescription')}</DialogDescription>
          </DialogHeader>
          <div className='flex items-center gap-2'>
            <Input readOnly value={generatedPassword ?? ''} className='font-mono' />
            <Button type='button' variant='outline' onClick={copyGenerated}>
              <Icons.copy /> {t('user.copyPassword')}
            </Button>
          </div>
          <DialogFooter>
            <Button
              type='button'
              onClick={() => {
                toast.success(t('user.created'));
                setGeneratedPassword(null);
                onOpenChange(false);
              }}
            >
              <Icons.check /> {t('user.generatedPasswordDone')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={open} onOpenChange={closeSheet}>
        <SheetContent className='flex flex-col'>
          <SheetHeader>
            <SheetTitle>{isEdit ? t('user.edit') : t('user.new')}</SheetTitle>
            <SheetDescription>
              {isEdit ? t('user.editDescription') : t('user.newDescription')}
            </SheetDescription>
          </SheetHeader>

          <div className='flex-1 overflow-auto'>
            <form.AppForm>
              <form.Form id='user-form-sheet' className='space-y-4'>
                <FormTextField
                  name='name'
                  label={t('user.name')}
                  required
                  placeholder={t('user.namePlaceholder')}
                  validators={{
                    onBlur: z.string().min(2, t('user.nameMin'))
                  }}
                />

                <FormTextField
                  name='email'
                  label={t('user.email')}
                  required
                  type='email'
                  placeholder={t('user.johnEmail')}
                  validators={{
                    onBlur: z.string().email(t('user.emailRequired'))
                  }}
                />

                <FormSelectField
                  name='role_group_id'
                  label={t('user.accessLevel')}
                  required
                  options={roleGroupOptions}
                  placeholder={t('user.selectAccessLevel')}
                />

                {!isEdit && (
                  <>
                    <FormTextField
                      name='password'
                      label={t('user.password')}
                      type='password'
                      autoComplete='new-password'
                      placeholder={t('user.passwordOptionalPlaceholder')}
                    />

                    <FormTextField
                      name='confirmPassword'
                      label={t('user.confirmPassword')}
                      type='password'
                      autoComplete='new-password'
                    />

                    <p className='text-muted-foreground text-sm'>
                      {t('user.optionalPasswordNotice')}
                    </p>
                    <p className='text-muted-foreground text-sm'>{t('user.rotationNotice')}</p>
                  </>
                )}

                <FormSelectField
                  name='status'
                  label={t('user.status')}
                  required
                  options={STATUS_OPTIONS}
                  placeholder={t('user.selectStatus')}
                  validators={{
                    onBlur: z.string().min(1, t('user.statusRequired'))
                  }}
                />
              </form.Form>
            </form.AppForm>
          </div>

          <SheetFooter>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type='submit' form='user-form-sheet' isLoading={isPending}>
              <Icons.check /> {isEdit ? t('user.updateUser') : t('user.createUser')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function UserFormSheetTrigger() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size='sm' onClick={() => setOpen(true)}>
        <Icons.add /> {t('user.addUser')}
      </Button>
      <UserFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
