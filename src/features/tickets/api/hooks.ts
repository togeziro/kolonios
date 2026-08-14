import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { takeTicketFn, completeTicketFn, createTicketFn, startLegFn } from './service';
import { ticketsKeys } from './queries';
import type { NewTicketInput } from './types';

export function useTakeTicket() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (ticketId: number) => takeTicketFn({ data: { ticketId } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('ticket.taken'));
        queryClient.invalidateQueries({ queryKey: ticketsKeys.all });
        queryClient.invalidateQueries({ queryKey: ticketsKeys.completed() });
      } else {
        toast.error(res?.message ?? t('ticket.takeFailed'));
      }
    },
    onError: () => {
      toast.error(t('ticket.takeFailed'));
    }
  });
}

export function useCompleteTicket() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (ticketId: number) => completeTicketFn({ data: { ticketId } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('ticket.completed'));
        queryClient.invalidateQueries({ queryKey: ticketsKeys.all });
        queryClient.invalidateQueries({ queryKey: ticketsKeys.completed() });
      } else {
        toast.error(res?.message ?? t('ticket.completeFailed'));
      }
    },
    onError: () => {
      toast.error(t('ticket.completeFailed'));
    }
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (input: NewTicketInput) => createTicketFn({ data: input }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('ticket.created'));
        queryClient.invalidateQueries({ queryKey: ticketsKeys.all });
        queryClient.invalidateQueries({ queryKey: ticketsKeys.completed() });
      } else {
        toast.error(res?.message ?? t('ticket.createFailed'));
      }
    },
    onError: () => {
      toast.error(t('ticket.createFailed'));
    }
  });
}

export function useStartLeg() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (legId: number) => startLegFn({ data: { legId } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('ticket.started'));
        queryClient.invalidateQueries({ queryKey: ticketsKeys.all });
        queryClient.invalidateQueries({ queryKey: ticketsKeys.completed() });
      } else {
        toast.error(res?.message ?? t('ticket.startFailed'));
      }
    },
    onError: () => toast.error(t('ticket.startFailed'))
  });
}
