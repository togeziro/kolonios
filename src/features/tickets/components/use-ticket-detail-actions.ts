import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  canCompleteTicket,
  resolveDetailLegAction,
  workSessionSubmitAllowed,
  type DetailLegAction
} from '@/lib/tickets/engine';
import type { TicketDetail } from '../api/types';

const FIELD_TASK_TYPES = ['installation', 'maintenance', 'inspection'] as const;

export type TicketDetailActions = {
  isField: boolean;
  domainLabel: string;
  legAction: DetailLegAction;
  isInProgress: boolean;
  isLastLeg: boolean;
  markCompleteGuard: { allowed: boolean; reason?: 'requiresPhoto' | 'requiresReview' };
  workGuard: { allowed: boolean; reason?: 'requiresPhoto' };
  showMarkComplete: boolean;
  showMarkCompleteDisabledReason: string | null;
};

const EMPTY_ACTIONS: TicketDetailActions = {
  isField: false,
  domainLabel: '',
  legAction: { kind: 'none' },
  isInProgress: false,
  isLastLeg: false,
  markCompleteGuard: { allowed: false },
  workGuard: { allowed: false },
  showMarkComplete: false,
  showMarkCompleteDisabledReason: null
};

/**
 * Resolves every action-guard decision the ticket detail page needs:
 * domain/field detection, the leg action (start / claim / none), the
 * mark-complete and work-session submission guards, and the client-side
 * is-last-leg prediction that labels the submit CTA.
 */
export function useTicketDetailActions(args: {
  ticket: TicketDetail | undefined;
  isAdmin: boolean;
  canEdit: boolean;
  inputPhotoCount: number;
}): TicketDetailActions {
  const { ticket, isAdmin, canEdit, inputPhotoCount } = args;
  const { t } = useTranslation();

  return useMemo(() => {
    if (!ticket) return EMPTY_ACTIONS;

    const isField = (FIELD_TASK_TYPES as readonly string[]).includes(ticket.taskType);
    const domain = isField ? ('field' as const) : ('backoffice' as const);
    const domainLabel = isField ? t('workSession.domainField') : t('workSession.domainBackoffice');
    const startableLeg = ticket.legs.find((l) => l.status === 'open' || l.status === 'assigned');
    const legAction = resolveDetailLegAction({
      status: ticket.status,
      isHolder: ticket.isHolder === true,
      startableLegId: startableLeg?.id ?? null,
      claimableLegId: ticket.claimableLeg?.legId ?? null,
      claimEligibilityReasons: ticket.claimEligibilityReasons ?? []
    });
    const isInProgress = ticket.status === 'in_progress';
    const existingPhotoCount = ticket.photos.length;
    const markCompleteGuard = canCompleteTicket({
      domain,
      isAdmin,
      photoCount: existingPhotoCount
    });
    const workGuard = workSessionSubmitAllowed({
      existingPhotoCount,
      inputPhotoCount
    });
    // Distinguish intermediate leg vs final leg: predicts isLastLeg client-side to label the CTA.
    // Mirrors server pickSubmittableLeg + resolveLegAdvance: in_progress first, then lowest leg_number.
    const submittableLeg = [...ticket.legs]
      .sort(
        (a, b) =>
          Number(b.status === 'in_progress') - Number(a.status === 'in_progress') ||
          a.legNumber - b.legNumber
      )
      .find((l) => ['open', 'assigned', 'in_progress'].includes(l.status));
    const hasNextLeg = submittableLeg
      ? ticket.legs.some(
          (l) => l.legNumber > submittableLeg.legNumber && ['open', 'assigned'].includes(l.status)
        )
      : false;
    const isLastLeg = isInProgress && !!submittableLeg && !hasNextLeg;
    // Field non-admin must go via Work Session → submitted → SPV review, hide Mark Complete entirely.
    const showMarkComplete = isInProgress && canEdit && markCompleteGuard.allowed;
    const showMarkCompleteDisabledReason =
      isInProgress && canEdit && !markCompleteGuard.allowed
        ? markCompleteGuard.reason === 'requiresPhoto'
          ? t('ticket.markCompleteRequiresPhoto')
          : t('ticket.markCompleteRequiresReview')
        : null;

    return {
      isField,
      domainLabel,
      legAction,
      isInProgress,
      isLastLeg,
      markCompleteGuard,
      workGuard,
      showMarkComplete,
      showMarkCompleteDisabledReason
    };
  }, [ticket, isAdmin, canEdit, inputPhotoCount, t]);
}
