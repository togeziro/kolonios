import { useTranslation } from 'react-i18next';
import { useRouter, Link } from '@tanstack/react-router';
import { useTheme } from 'next-themes';
import { supportedLanguages, type SupportedLanguage } from '@/i18n/config';
import { applyLanguage } from '@/lib/preferences/language';
import { setShellDark, useShellDark } from '@/lib/preferences/shell-dark';
import { APP_VERSION } from '@/lib/version';
import { initialsFromName } from '@/lib/format';
import { signOut, useSession } from '@/lib/auth/auth-client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { hasModulePermission } from '@/lib/auth/session';
import { BrandingSection } from '@/features/branding/components/branding-section';

const languageLabels: Record<SupportedLanguage, string> = {
  en: 'English',
  id: 'Indonesia'
};

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const { setTheme } = useTheme();
  const dark = useShellDark();
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canManageBranding = hasModulePermission(permissions, isAdmin, 'settings', 'edit');

  const user = session?.user;
  const name = user?.name ?? 'User';
  const email = user?.email ?? '';
  const currentLanguage = i18n.language as SupportedLanguage;

  async function handleLogout() {
    await signOut();
    router.navigate({ to: '/' });
  }

  function handleTheme(next: 'light' | 'dark') {
    // Drive both sources: the fieldops shell store (MobileShell syncs
    // next-themes from it via effect) and next-themes directly so the row
    // also applies instantly inside the sidebar shell.
    setShellDark(next === 'dark');
    setTheme(next);
  }

  return (
    <div className='space-y-5'>
      {canManageBranding && (
        <section className='space-y-2'>
          <p className='text-muted-foreground text-[11px] font-medium uppercase tracking-wider'>
            {t('branding.section')}
          </p>
          <BrandingSection />
        </section>
      )}

      <Card className='flex items-center gap-3 rounded-2xl p-4 dark:border-zinc-800/50 dark:bg-zinc-900'>
        <Avatar className='border dark:border-zinc-700 h-14 w-14'>
          <AvatarFallback className='bg-primary/10 text-primary text-lg font-semibold'>
            {initialsFromName(name)}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0 flex-1'>
          <p className='truncate text-sm font-semibold dark:text-zinc-100'>{name}</p>
          <p className='text-muted-foreground truncate text-xs'>{email}</p>
        </div>
        <Link
          to='/dashboard/edit-profile'
          className='dark:bg-zinc-800 dark:text-zinc-100 rounded-full bg-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-900'
        >
          {t('common.edit')}
        </Link>
      </Card>

      <section className='space-y-2'>
        <p className='text-muted-foreground text-[11px] font-medium uppercase tracking-wider'>
          {t('settingsPage.preferences')}
        </p>
        <Card className='divide-y rounded-2xl dark:divide-zinc-800/50 dark:border-zinc-800/50 dark:bg-zinc-900'>
          <div className='flex items-center gap-3 px-4 py-3.5'>
            <Icons.globe className='text-muted-foreground h-4 w-4' />
            <span className='flex-1 text-sm dark:text-zinc-100'>{t('settingsPage.language')}</span>
            <div className='flex gap-1' role='group' aria-label={t('settingsPage.language')}>
              {supportedLanguages.map((lng) => (
                <button
                  key={lng}
                  type='button'
                  onClick={() => applyLanguage(i18n, lng)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
                    currentLanguage === lng
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {languageLabels[lng]}
                </button>
              ))}
            </div>
          </div>
          <div className='flex items-center gap-3 px-4 py-3.5'>
            {dark ? (
              <Icons.moon className='text-muted-foreground h-4 w-4' />
            ) : (
              <Icons.sun className='text-muted-foreground h-4 w-4' />
            )}
            <span className='flex-1 text-sm dark:text-zinc-100'>{t('settingsPage.theme')}</span>
            <div className='flex gap-1' role='group' aria-label={t('settingsPage.theme')}>
              {(['light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  type='button'
                  aria-pressed={dark === (mode === 'dark')}
                  onClick={() => handleTheme(mode)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
                    dark === (mode === 'dark')
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {t(`settingsPage.${mode}`)}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className='space-y-2'>
        <p className='text-muted-foreground text-[11px] font-medium uppercase tracking-wider'>
          {t('settingsPage.account')}
        </p>
        <Card className='rounded-2xl dark:border-zinc-800/50 dark:bg-zinc-900'>
          <Link
            to='/dashboard/change-password'
            className='hover:bg-muted flex items-center gap-3 px-4 py-3.5 text-sm dark:text-zinc-100'
          >
            <Icons.lock className='text-muted-foreground h-4 w-4' />
            {t('settingsPage.changePassword')}
            <Icons.chevronRight className='text-muted-foreground ml-auto h-4 w-4' />
          </Link>
          <hr className='dark:border-zinc-800/50' />
          <div className='flex items-center gap-3 px-4 py-3.5 text-sm dark:text-zinc-100'>
            <Icons.info className='text-muted-foreground h-4 w-4' />
            {t('settingsPage.about')}
            <span className='dark:bg-zinc-800 dark:text-zinc-300 ml-auto rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 tabular-nums'>
              {APP_VERSION}
            </span>
          </div>
        </Card>
      </section>

      <Button
        variant='outline'
        onClick={handleLogout}
        className='w-full rounded-2xl border-red-500/40 py-3 font-semibold text-red-500 hover:bg-red-500/10 hover:text-red-500 dark:border-red-400/40 dark:text-red-400'
      >
        <Icons.logout className='mr-2 h-4 w-4' />
        {t('settingsPage.logOut')}
      </Button>
    </div>
  );
}
