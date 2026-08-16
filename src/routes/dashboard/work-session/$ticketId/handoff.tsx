import { createFileRoute, useParams } from "@tanstack/react-router";
import HandoffConfirmation from "@/features/tickets/components/handoff-confirmation";

export const Route = createFileRoute(
  "/dashboard/work-session/$ticketId/handoff",
)({
  head: () => ({ meta: [{ title: "Dashboard: Handoff" }] }),
  component: HandoffRoute,
});

function HandoffRoute() {
  const { ticketId } = useParams({ from: Route.id });
  const parsed = Number(ticketId);
  const valid = Number.isInteger(parsed) && parsed > 0;
  return <HandoffConfirmation ticketId={valid ? parsed : 0} />;
}
