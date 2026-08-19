import { createFileRoute, useParams } from '@tanstack/react-router';
import EnRouteNavigationPage from '@/features/tickets/components/en-route-navigation';

export const Route = createFileRoute('/dashboard/en-route/$ticketId')({
  head: () => ({ meta: [{ title: 'Dashboard: En Route' }] }),
  component: EnRouteNavigationRoute
});

function EnRouteNavigationRoute() {
  const { ticketId } = useParams({ from: Route.id });
  const parsed = Number(ticketId);
  const valid = Number.isInteger(parsed) && parsed > 0;
  return <EnRouteNavigationPage ticketId={valid ? parsed : 0} />;
}
