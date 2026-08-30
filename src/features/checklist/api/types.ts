import type { ChecklistItemOutcome, DailyChecklistStatus } from '@/lib/db/schema/checklists';

export type { ChecklistItemOutcome, DailyChecklistStatus };

export type ChecklistDayStatus = 'working' | 'no_schedule' | 'day_off' | 'holiday';

export type DailyChecklist = {
  id: number;
  checklistDate: string;
  status: DailyChecklistStatus;
  shiftName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  startedAt: string | null;
  endedAt: string | null;
  globalNote: string;
};

export type ChecklistItem = {
  id: number;
  itemKey: string;
  outcome: ChecklistItemOutcome;
  note: string;
  photoKey: string;
};

export type DailyChecklistResponse = {
  success: boolean;
  dayStatus: ChecklistDayStatus;
  checklist: DailyChecklist | null;
  items: ChecklistItem[];
  completedLegsCount?: number;
};
