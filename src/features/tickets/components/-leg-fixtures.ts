// TODO(wire): Leg data does not exist on ticket list items yet (Ticket carries
// no legs). This map stands in for the future leg lookup DTO — keyed by
// ticketId, mirroring TicketLeg.legNumber from src/lib/domain/tickets.ts.
// The wiring pass replaces this import with a real server-provided map;
// JobsPage already accepts the same shape via its `legMap` prop.
export type TicketLegInfo = {
  legNumber: number;
  legsTotal: number;
};

export const LEG_FIXTURES: Record<number, TicketLegInfo> = {
  4101: { legNumber: 1, legsTotal: 3 },
  4102: { legNumber: 2, legsTotal: 3 },
  4103: { legNumber: 3, legsTotal: 3 }
};
