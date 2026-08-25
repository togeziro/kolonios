import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authClient, useSession } from '@/lib/auth/auth-client';
import { uploadSelfie } from '@/lib/storage/upload-client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import { avatarUrlQueryOptions } from '../api/queries';
import { myWorkInfoFixture } from '../lib/work-info';

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

export default function EditProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: session } = useSession();
  const user = session?.user;
  const sessionName = user?.name ?? '';
  const email = user?.email ?? '';
  const image = user?.image;

  const [displayName, setDisplayName] = useState(sessionName);
  const [syncedSessionName, setSyncedSessionName] = useState(sessionName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarHint, setAvatarHint] = useState<string | null>(null);

  // Re-sync the draft when the session hydrates or updates (better-auth
  // signals) — adjusted during render per React's recommended pattern.
  if (syncedSessionName !== sessionName) {
    setSyncedSessionName(sessionName);
    setDisplayName(sessionName);
  }

  // An object key (e.g. "attendance/u/1.jpg") resolves through the storage
  // presign path; http(s)/data URLs render directly; anything else falls
  // back to initials.
  const isObjectKey = Boolean(image && !image.startsWith('http') && !image.startsWith('data:'));
  const { data: avatarData } = useQuery({
    ...avatarUrlQueryOptions(isObjectKey && image ? image : ''),
    enabled: isObjectKey
  });
  const avatarSrc = image && !isObjectKey ? image : isObjectKey ? (avatarData?.url ?? null) : null;

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    setIsUploading(true);
    setAvatarHint(null);
    try {
      const dataUrl = await readAsDataURL(file);
      // TODO(wire): 'attendance' is the only existing upload folder — a
      // dedicated avatars folder/presign path is pending backend scope.
      const key = await uploadSelfie(dataUrl, 'attendance');
      await authClient.updateUser({ image: key });
      toast.success(t('editProfile.avatarUpdated'));
    } catch {
      // Storage unconfigured or upload failed: keep the initials fallback.
      setAvatarHint(t('editProfile.avatarUnavailable'));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSaveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed || trimmed === sessionName || isSavingName) return;

    setIsSavingName(true);
    try {
      const { error } = await authClient.updateUser({ name: trimmed });
      if (error) {
        toast.error(t('editProfile.saveFailed'));
        return;
      }
      toast.success(t('editProfile.profileSaved'));
    } catch {
      toast.error(t('editProfile.saveFailed'));
    } finally {
      setIsSavingName(false);
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
            {t('editProfile.title')}
          </h1>
        </div>
      </header>

      <main className='flex-1 space-y-6 px-4 py-6'>
        <div className='relative mx-auto w-fit'>
          <Avatar className='dark:border-zinc-800 h-24 w-24 border-2'>
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={t('editProfile.avatarAlt')}
                className='h-full w-full rounded-full object-cover'
              />
            ) : (
              <AvatarFallback className='bg-primary/10 text-primary text-xl font-semibold'>
                {initialsOf(sessionName)}
              </AvatarFallback>
            )}
          </Avatar>
          <button
            type='button'
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            aria-label={t('editProfile.changePhoto')}
            className='dark:border-zinc-950 dark:bg-zinc-700 dark:text-zinc-100 absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-white shadow-md transition-colors hover:bg-zinc-700 disabled:opacity-60'
          >
            {isUploading ? (
              <Icons.spinner className='h-4 w-4 animate-spin' />
            ) : (
              <Icons.camera className='h-4 w-4' />
            )}
          </button>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            data-testid='avatar-file-input'
            onChange={handleAvatarChange}
            className='hidden'
            aria-hidden='true'
            tabIndex={-1}
          />
        </div>
        {avatarHint && (
          <p role='status' className='text-muted-foreground -mt-3 text-center text-xs'>
            {avatarHint}
          </p>
        )}

        <form onSubmit={handleSaveName} className='space-y-6'>
          <section className='dark:border-zinc-800/50 dark:bg-zinc-900 space-y-4 rounded-2xl border p-4'>
            <h2 className='text-muted-foreground dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider'>
              {t('editProfile.personalInfo')}
            </h2>
            <div className='space-y-1.5'>
              <label
                htmlFor='full-name'
                className='text-muted-foreground dark:text-zinc-400 block px-1 text-xs font-medium'
              >
                {t('editProfile.fullName')}
              </label>
              <Input
                id='full-name'
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete='name'
                className='dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 h-11 rounded-xl px-4 text-sm'
              />
            </div>
            <div className='space-y-1.5'>
              <label
                htmlFor='email'
                className='text-muted-foreground dark:text-zinc-400 block px-1 text-xs font-medium'
              >
                {t('editProfile.email')}
              </label>
              <div className='relative'>
                <Input
                  id='email'
                  type='email'
                  value={email}
                  disabled
                  readOnly
                  className='dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 h-11 rounded-xl px-4 pr-10 text-sm'
                />
                <Icons.lock className='text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2' />
              </div>
              <p className='text-muted-foreground dark:text-zinc-500 px-1 text-xs'>
                {t('editProfile.emailLockedHint')}
              </p>
            </div>
          </section>

          <Button
            type='submit'
            disabled={isSavingName || !displayName.trim() || displayName.trim() === sessionName}
            className='h-12 w-full rounded-xl text-sm font-semibold'
          >
            {isSavingName ? (
              <>
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                {t('editProfile.saving')}
              </>
            ) : (
              t('editProfile.saveChanges')
            )}
          </Button>
        </form>

        <section className='dark:border-zinc-800/50 dark:bg-zinc-900 space-y-3 rounded-2xl border p-4'>
          <h2 className='text-muted-foreground dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider'>
            {t('editProfile.workInfo')}
          </h2>
          {/* TODO(wire): rendered from fixtures until a self-profile server function exists. */}
          <dl>
            {[
              { label: t('editProfile.employeeCode'), value: myWorkInfoFixture.employeeCode },
              { label: t('editProfile.department'), value: myWorkInfoFixture.department },
              { label: t('editProfile.jobTitle'), value: myWorkInfoFixture.jobTitle }
            ].map((row) => (
              <div
                key={row.label}
                className='dark:border-zinc-800/50 flex items-center justify-between border-b py-2.5 last:border-0'
              >
                <dt className='text-muted-foreground dark:text-zinc-400 text-xs'>{row.label}</dt>
                <dd className='dark:text-zinc-200 text-sm font-medium'>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
