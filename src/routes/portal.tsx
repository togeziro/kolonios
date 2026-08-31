import { createFileRoute, redirect } from '@tanstack/react-router';
import { PortalShell } from '@/components/layout/portal-shell';

export const Route = createFileRoute('/portal')({
  beforeLoad: async () => {
    const { requirePortalSession } = await import('@/features/portal/api/session');
    let portal: Awaited<ReturnType<typeof requirePortalSession>>;
    try {
      portal = await requirePortalSession();
    } catch {
      throw redirect({ to: '/auth/v2/sign-in' });
    }
    if (!portal.ok && portal.reason === 'not_customer') {
      throw redirect({ to: '/dashboard/overview', search: { denied: undefined } });
    }
    return { portal };
  },
  component: PortalLayout
});

function PortalLayout() {
  return <PortalShell />;
}
