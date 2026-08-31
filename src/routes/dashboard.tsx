import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { MobileShell } from '@/components/layout/mobile-shell';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRoleGroupPermissions } from '@/hooks/use-nav';
import { useSession } from '@/lib/auth/auth-client';
import { isDev } from '@/lib/env';
import { logger } from '@/lib/logger';
import { resolveRouteGuard } from '@/lib/auth/route-guard';
import { resolveShell } from '@/lib/shells/resolve';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => {
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

    // Centralized fail-closed route guard: every dashboard path is mapped to
    // a module.action via the registry; anything unregistered is denied with
    // a loud dev-mode warning. Per-route guards below remain as defence in
    // depth (see ADR-0005).
    const guard = resolveRouteGuard(location.pathname);
    if (guard === 'unregistered') {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.warn(
          `[route-guard] Unregistered dashboard path "${location.pathname}" — denying (fail-closed). Add an entry to ROUTE_REGISTRY in src/lib/auth/route-guard.ts.`
        );
      }
      logger.warn(
        { pathname: location.pathname, userId: session.user.id },
        'route-guard: unregistered dashboard path'
      );
      throw redirect({
        to: '/dashboard/overview',
        search: { denied: 'unregistered' }
      });
    }
    if (guard !== null) {
      const { requirePermissionRpc } = await import('@/lib/auth/session');
      try {
        await requirePermissionRpc({ data: `${guard.module}.${guard.action}` });
      } catch {
        throw redirect({
          to: '/dashboard/overview',
          search: { denied: `${guard.module}.${guard.action}` }
        });
      }
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
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
