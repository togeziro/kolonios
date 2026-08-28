import { createFileRoute } from '@tanstack/react-router';
import { GeneratePage } from './-generate-page';

export const Route = createFileRoute('/dashboard/admin/payroll/generate')({
  beforeLoad: async () => {
    const { requirePermissionRpc } = await import('@/lib/auth/session');
    await requirePermissionRpc({ data: 'payroll.edit' });
  },
  component: GeneratePage
});
