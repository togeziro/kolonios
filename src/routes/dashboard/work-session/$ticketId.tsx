import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/work-session/$ticketId')({
  head: () => ({ meta: [{ title: 'Dashboard: Work Session' }] }),
  component: WorkSessionLayout
});

function WorkSessionLayout() {
  return <Outlet />;
}
