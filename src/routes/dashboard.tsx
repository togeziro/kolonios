import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { MobileShell } from '@/components/layout/mobile-shell';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSession } from '@/lib/auth/auth-client';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const { ensureSession } = await import('@/lib/auth/session');
    try {
      await ensureSession();
    } catch {
      throw redirect({ to: '/auth/v2/sign-in' });
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
  const role = session?.user?.role;
  const isStaff = role === 'employee' || role === 'technician';

  if (isMobile && isStaff) {
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
