export type ChecklistEntryVariant = 'card' | 'chip';

export type ChecklistEntryTone = 'action' | 'info';

export type ChecklistEntryDecision = {
  visible: boolean;
  tone: ChecklistEntryTone;
  statusKey: string;
};

/**
 * Whether a Daily Checklist entry point should render, and how.
 * - card (dashboard): any existing checklist for today
 * - chip (My Work): advisory only while actionable (draft / rejected)
 */
export function checklistEntryState(input: {
  status: string | null;
  viewAllowed: boolean;
  variant: ChecklistEntryVariant;
}): ChecklistEntryDecision {
  const base = { visible: false, tone: 'info' as const, statusKey: 'checklist.status.draft' };
  if (!input.viewAllowed || input.status === null) return base;

  if (input.status === 'draft') {
    return { visible: true, tone: 'action', statusKey: 'checklist.status.draft' };
  }
  if (input.status === 'rejected') {
    return { visible: true, tone: 'action', statusKey: 'checklist.status.rejected' };
  }
  if (input.variant === 'card') {
    return {
      visible: true,
      tone: 'info',
      statusKey: `checklist.status.${input.status}`
    };
  }
  return base;
}

export function isChecklistViewAllowed(
  permissions: Record<string, Record<string, boolean>>,
  isAdmin: boolean
): boolean {
  return isAdmin || permissions['checklist']?.view === true;
}
