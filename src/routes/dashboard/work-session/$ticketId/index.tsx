import { createFileRoute, useParams } from "@tanstack/react-router";
import WorkSessionPage from "@/features/tickets/components/work-session-page";

export const Route = createFileRoute("/dashboard/work-session/$ticketId/")({
  component: WorkSessionRoute,
});

function WorkSessionRoute() {
  const { ticketId } = useParams({ from: Route.id });
  const parsed = Number(ticketId);
  const valid = Number.isInteger(parsed) && parsed > 0;
  return <WorkSessionPage ticketId={valid ? parsed : 0} />;
}
