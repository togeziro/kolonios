import { createFileRoute, redirect, useParams } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard/work-session/$ticketId/')({
  beforeLoad: ({ params }) => {
    const parsed = Number(params.ticketId);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    throw redirect({ to: '/dashboard/tickets/$ticketId', params: { ticketId: String(parsed) } });
  },
  component: WorkSessionRoute
});

function WorkSessionRoute() {
  const { ticketId } = useParams({ from: Route.id });
  const parsed = Number(ticketId);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  // Fallback render while redirecting — TanStack will handle beforeLoad redirect
  return null;
}
