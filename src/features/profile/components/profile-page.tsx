import { useRouter } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useSession, signOut } from '@/lib/auth/auth-client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { attendanceSummaryQueryOptions } from '@/features/attendance/api/queries';
import { myTicketsQueryOptions } from '@/features/tickets/api/queries';
import { useTranslation } from 'react-i18next';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const { data: summaryData } = useQuery(attendanceSummaryQueryOptions());
  const { data: tasksData } = useQuery(myTicketsQueryOptions());

  const user = session?.user;
  const name = user?.name ?? 'User';
  const email = user?.email ?? '';
  const role = user?.role ?? 'user';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const summary = summaryData?.summary;
  const tasks = tasksData?.tickets ?? [];
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;

  async function handleLogout() {
    await signOut();
    router.navigate({ to: '/' });
  }

  return (
    <div className='space-y-5 p-4'>
      <div className='flex flex-col items-center gap-2 pt-4'>
        <Avatar className='border h-20 w-20'>
          <AvatarFallback className='bg-primary/10 text-primary text-xl font-semibold'>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className='text-center'>
          <p className='text-base font-semibold'>{name}</p>
          <p className='text-muted-foreground text-xs'>{email}</p>
        </div>
        <Badge variant='secondary' className='rounded-full capitalize'>
          {role}
        </Badge>
      </div>

      <Card className='rounded-2xl p-4'>
        <p className='text-muted-foreground mb-2 text-[11px] font-medium uppercase'>
          {t('profile.thisMonth')}
        </p>
        <div className='flex justify-around text-center'>
          <div>
            <p className='text-lg font-semibold tabular-nums'>{summary?.present ?? '—'}</p>
            <p className='text-muted-foreground text-[11px]'>{t('profile.present')}</p>
          </div>
          <div>
            <p className='text-lg font-semibold tabular-nums'>{summary?.late ?? '—'}</p>
            <p className='text-muted-foreground text-[11px]'>{t('profile.late')}</p>
          </div>
          <div>
            <p className='text-lg font-semibold tabular-nums'>{summary?.absent ?? '—'}</p>
            <p className='text-muted-foreground text-[11px]'>{t('profile.absent')}</p>
          </div>
          <div>
            <p className='text-lg font-semibold tabular-nums'>{inProgress}</p>
            <p className='text-muted-foreground text-[11px]'>{t('profile.activeTasks')}</p>
          </div>
        </div>
      </Card>

      <Card className='rounded-2xl'>
        <Link
          to='/dashboard/notifications'
          className='hover:bg-muted flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm'
        >
          <Icons.notification className='text-muted-foreground h-4 w-4' />
          {t('profile.notifications')}
          <Icons.chevronRight className='text-muted-foreground ml-auto h-4 w-4' />
        </Link>
        <hr />
        <Link
          to='/dashboard/achievements'
          className='hover:bg-muted flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm'
        >
          <Icons.badgeCheck className='text-muted-foreground h-4 w-4' />
          {t('navigation.achievements')}
          <Icons.chevronRight className='text-muted-foreground ml-auto h-4 w-4' />
        </Link>
        <hr />
        <button
          onClick={handleLogout}
          className='hover:bg-muted flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm'
        >
          <Icons.logout className='text-muted-foreground h-4 w-4' />
          {t('profile.signOut')}
          <Icons.chevronRight className='text-muted-foreground ml-auto h-4 w-4' />
        </button>
      </Card>
    </div>
  );
}
