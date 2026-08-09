import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { MobileShell } from '@/components/layout/mobile-shell';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { useSession } from '@/lib/auth/auth-client';
import { resolveShell } from '@/lib/shells/resolve';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const { ensureSession } = await import('@/lib/auth/session');
    let session: Awaited<ReturnType<typeof ensureSession>> | null = null;
    try {
      session = await ensureSession();
    } catch {
      session = null;
    }
    if (!session) {
      throw redirect({ to: '/auth/v2/sign-in' });
    }
    if (session.user.role === 'customer') {
      throw redirect({ to: '/portal' });
    }
  },
  head: () => ({
    meta: [
      { title: 'Kolonios' },
      {
        name: 'description',
        content: 'HR, attendance, and payroll management'
      },
      { name: 'robots', content: 'noindex, nofollow' }
    ]
  }),
  component: DashboardLayout
});

function DashboardLayout() {
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const { group } = useRoleGroupPermissions();
  const shell = resolveShell({ role: session?.user?.role, roleGroup: group });

  if (shell === 'fieldops' && isMobile) {
    return <MobileShell />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <InfobarProvider defaultOpen={false}>
          <Outlet />
          <InfoSidebar side='right' />
        </InfobarProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
