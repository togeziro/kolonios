import { queryOptions } from '@tanstack/react-query';
import { getMyTicketsFn, listOpenTicketsFn, getTicketDetailFn } from './service';
import type { TicketListFilters } from './types';

export const ticketsKeys = {
  all: ['tickets'] as const,
  mine: () => [...ticketsKeys.all, 'mine'] as const,
  open: (filters: TicketListFilters) => [...ticketsKeys.all, 'open', filters] as const,
  detail: (ticketId: number) => [...ticketsKeys.all, 'detail', ticketId] as const
};

export const myTicketsQueryOptions = () =>
  queryOptions({
    queryKey: ticketsKeys.mine(),
    queryFn: () => getMyTicketsFn()
  });

export const openTicketsQueryOptions = (filters: TicketListFilters = {}) =>
  queryOptions({
    queryKey: ticketsKeys.open(filters),
    queryFn: () => listOpenTicketsFn({ data: filters })
  });

export const ticketDetailQueryOptions = (ticketId: number) =>
  queryOptions({
    queryKey: ticketsKeys.detail(ticketId),
    queryFn: () => getTicketDetailFn({ data: { ticketId } })
  });
