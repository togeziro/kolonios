import { queryOptions } from '@tanstack/react-query';
import {
  getMyTicketsFn,
  listOpenTicketsFn,
  listTicketsFn,
  getTicketDetailFn,
  getCompletedTicketsFn,
  listSubmittedTicketsFn
} from './service';
import { getObjectUrlFn } from '@/features/storage/api/service';
import type { TicketListFilters } from './types';

export const ticketsKeys = {
  all: ['tickets'] as const,
  mine: () => [...ticketsKeys.all, 'mine'] as const,
  open: (filters: TicketListFilters) => [...ticketsKeys.all, 'open', filters] as const,
  list: (filters: TicketListFilters) => [...ticketsKeys.all, 'list', filters] as const,
  detail: (ticketId: number) => [...ticketsKeys.all, 'detail', ticketId] as const,
  completed: () => [...ticketsKeys.all, 'completed'] as const,
  submitted: () => [...ticketsKeys.all, 'submitted'] as const
};

export const myTicketsQueryOptions = () =>
  queryOptions({
    queryKey: ticketsKeys.mine(),
    queryFn: () => getMyTicketsFn()
  });

export const completedTicketsQueryOptions = () =>
  queryOptions({
    queryKey: ticketsKeys.completed(),
    queryFn: () => getCompletedTicketsFn()
  });

export const submittedTicketsQueryOptions = () =>
  queryOptions({
    queryKey: ticketsKeys.submitted(),
    queryFn: () => listSubmittedTicketsFn()
  });

export const openTicketsQueryOptions = (filters: TicketListFilters = {}) =>
  queryOptions({
    queryKey: ticketsKeys.open(filters),
    queryFn: () => listOpenTicketsFn({ data: filters })
  });

export const listTicketsQueryOptions = (filters: TicketListFilters = {}) =>
  queryOptions({
    queryKey: ticketsKeys.list(filters),
    queryFn: () => listTicketsFn({ data: filters })
  });

export const ticketDetailQueryOptions = (ticketId: number) =>
  queryOptions({
    queryKey: ticketsKeys.detail(ticketId),
    queryFn: () => getTicketDetailFn({ data: { ticketId } })
  });

export const photoUrlQueryOptions = (key: string) =>
  queryOptions({
    queryKey: [...ticketsKeys.all, 'photo', key] as const,
    queryFn: () => getObjectUrlFn({ data: { key } })
  });
