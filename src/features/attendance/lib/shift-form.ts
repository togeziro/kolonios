import * as z from 'zod';

// Client-side form schema mirrors the server-side zod shape from
// `features/attendance/api/validation.ts` but uses string inputs for the
// number fields so the form can type cleanly.

// --- Shared defaults (also enforced server-side by createSchedule defaults) ---
export const DEFAULT_START_TIME = '08:00';
export const DEFAULT_END_TIME = '17:00';
export const DEFAULT_LATE_TOLERANCE_MINUTES = 5;
export const DEFAULT_ABSENCE_CUTOFF_MINUTES = 120;
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const WEEKDAY_RANGE = { min: 1, max: 5 } as const;
export const MAX_DAY_INDEX = 6;
export const MAX_SHIFT_NAME_LENGTH = 200;
export const MAX_SHIFT_NOTE_LENGTH = 1000;

function isWeekday(dayOfWeek: number): boolean {
  return dayOfWeek >= WEEKDAY_RANGE.min && dayOfWeek <= WEEKDAY_RANGE.max;
}

const timeString = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:MM format');

export const shiftWeekdayRuleFormSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(MAX_DAY_INDEX),
  isWorkingDay: z.boolean(),
  startTime: z.string(),
  endTime: z.string()
});

export type ShiftWeekdayRuleFormValues = z.infer<typeof shiftWeekdayRuleFormSchema>;

const colorPresetHex = /^#[0-9a-fA-F]{6}$/;

export const shiftFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(MAX_SHIFT_NAME_LENGTH),
  startTime: timeString,
  endTime: timeString,
  breakStart: z.string().optional(),
  breakEnd: z.string().optional(),
  maxBreakMinutes: z.string().optional(),
  color: z.string().regex(colorPresetHex).nullable().optional(),
  note: z.string().max(MAX_SHIFT_NOTE_LENGTH).optional(),
  lateToleranceMinutes: z.string(),
  absenceCutoffMinutes: z.string(),
  status: z.enum(['active', 'inactive']),
  weekdayRules: z.array(shiftWeekdayRuleFormSchema)
});

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;

// Empty state used when opening the "Add" dialog. Mirrors the server
// `createSchedule` defaults: Mon–Fri 08:00–17:00, tolerance 5, cutoff 120.
export const EMPTY_SHIFT_FORM: ShiftFormValues = {
  name: '',
  startTime: DEFAULT_START_TIME,
  endTime: DEFAULT_END_TIME,
  breakStart: '',
  breakEnd: '',
  maxBreakMinutes: '',
  color: null,
  note: '',
  lateToleranceMinutes: String(DEFAULT_LATE_TOLERANCE_MINUTES),
  absenceCutoffMinutes: String(DEFAULT_ABSENCE_CUTOFF_MINUTES),
  status: 'active',
  weekdayRules: ALL_DAYS.map((dayOfWeek) => ({
    dayOfWeek,
    isWorkingDay: isWeekday(dayOfWeek),
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME
  }))
};

// Coerce the form values to the server payload shape expected by
// `createShiftFn` / `updateShiftFn`. Empty optionals are dropped.
export function shiftFormToPayload(v: ShiftFormValues) {
  return {
    withBreakWindow: {
      name: v.name.trim(),
      startTime: v.startTime,
      endTime: v.endTime,
      type: 'fixed' as const,
      color: v.color ?? null,
      note: v.note && v.note.trim() ? v.note.trim() : null,
      lateToleranceMinutes: Number(v.lateToleranceMinutes),
      absenceCutoffMinutes: Number(v.absenceCutoffMinutes),
      weekdayRules: v.weekdayRules.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        isWorkingDay: r.isWorkingDay,
        startTime: r.isWorkingDay ? r.startTime : null,
        endTime: r.isWorkingDay ? r.endTime : null
      })),
      breakStart: v.breakStart && v.breakStart !== '' ? v.breakStart : null,
      breakEnd: v.breakEnd && v.breakEnd !== '' ? v.breakEnd : null,
      maxBreakMinutes:
        v.breakStart && v.breakEnd && v.maxBreakMinutes ? Number(v.maxBreakMinutes) : null
    },
    status: v.status
  };
}

export const DAY_KEYS = [
  'attendance.daySun',
  'attendance.dayMon',
  'attendance.dayTue',
  'attendance.dayWed',
  'attendance.dayThu',
  'attendance.dayFri',
  'attendance.daySat'
] as const;
