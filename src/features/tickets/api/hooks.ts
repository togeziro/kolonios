import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  takeTicketFn,
  completeTicketFn,
  createTicketFn,
  startLegFn,
  arriveTicketFn,
  submitWorkSessionFn,
  submitHandoffNoteFn
} from './service';
import { ticketsKeys } from './queries';
import type { NewTicketInput } from './types';
import type { WorkSessionSubmit } from './validation';

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
        const msg = res?.message ?? '';
        if (msg.includes('at least 1 photo')) {
          toast.error(t('ticket.markCompleteRequiresPhoto'));
        } else if (msg.includes('Field tickets must be submitted via Work Session')) {
          toast.error(t('ticket.markCompleteRequiresReview'));
        } else {
          toast.error(msg || t('ticket.completeFailed'));
        }
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

export function useArriveTicket() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (input: {
      ticketId: number;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
    }) => arriveTicketFn({ data: input }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('enRoute.arrivedSuccess'));
        queryClient.invalidateQueries({ queryKey: ticketsKeys.all });
        queryClient.invalidateQueries({ queryKey: ticketsKeys.completed() });
      } else {
        toast.error(res?.message ?? t('enRoute.arrivedFailed'));
      }
    },
    onError: () => toast.error(t('enRoute.arrivedFailed'))
  });
}

export function useSubmitWorkSession() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (input: WorkSessionSubmit) => submitWorkSessionFn({ data: input }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('workSession.submitSuccess'));
        queryClient.invalidateQueries({ queryKey: ticketsKeys.all });
        queryClient.invalidateQueries({ queryKey: ticketsKeys.completed() });
      } else {
        const msg = res?.message ?? '';
        if (msg.includes('at least 1 photo')) {
          toast.error(t('ticket.markCompleteRequiresPhoto'));
        } else {
          toast.error(msg || t('workSession.submitFailed'));
        }
      }
    },
    onError: () => toast.error(t('workSession.submitFailed'))
  });
}

export function useSubmitHandoffNote() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ legId, note }: { legId: number; note: string }) =>
      submitHandoffNoteFn({ data: { legId, note } }),
    onSuccess: (res) => {
      if (res?.success) {
        toast.success(t('handoff.saved'));
        queryClient.invalidateQueries({ queryKey: ticketsKeys.all });
      } else {
        toast.error(res?.message ?? t('handoff.saveFailed'));
      }
    },
    onError: () => toast.error(t('handoff.saveFailed'))
  });
}
