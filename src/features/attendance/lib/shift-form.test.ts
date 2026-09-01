import { describe, expect, it } from 'vitest';
import {
  ALL_DAYS,
  DEFAULT_ABSENCE_CUTOFF_MINUTES,
  DEFAULT_LATE_TOLERANCE_MINUTES,
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  EMPTY_SHIFT_FORM,
  shiftFormSchema,
  shiftFormToPayload,
  WEEKDAY_RANGE
} from './shift-form';

describe('shift-form defaults', () => {
  it('mirrors the server createSchedule defaults', () => {
    expect(DEFAULT_START_TIME).toBe('08:00');
    expect(DEFAULT_END_TIME).toBe('17:00');
    expect(DEFAULT_LATE_TOLERANCE_MINUTES).toBe(5);
    expect(DEFAULT_ABSENCE_CUTOFF_MINUTES).toBe(120);
    expect(WEEKDAY_RANGE).toEqual({ min: 1, max: 5 });
    expect(ALL_DAYS).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('seeds all 7 days with Mon–Fri as working and Sat–Sun off', () => {
    expect(EMPTY_SHIFT_FORM.weekdayRules).toHaveLength(7);
    const byDay = new Map(EMPTY_SHIFT_FORM.weekdayRules.map((r) => [r.dayOfWeek, r]));
    for (const day of [0, 6]) {
      expect(byDay.get(day)?.isWorkingDay).toBe(false);
    }
    for (const day of [1, 2, 3, 4, 5]) {
      const r = byDay.get(day);
      expect(r?.isWorkingDay).toBe(true);
      expect(r?.startTime).toBe(DEFAULT_START_TIME);
      expect(r?.endTime).toBe(DEFAULT_END_TIME);
    }
  });

  it('starts with empty optional fields and an active status', () => {
    expect(EMPTY_SHIFT_FORM.name).toBe('');
    expect(EMPTY_SHIFT_FORM.breakStart).toBe('');
    expect(EMPTY_SHIFT_FORM.breakEnd).toBe('');
    expect(EMPTY_SHIFT_FORM.maxBreakMinutes).toBe('');
    expect(EMPTY_SHIFT_FORM.color).toBeNull();
    expect(EMPTY_SHIFT_FORM.note).toBe('');
    expect(EMPTY_SHIFT_FORM.status).toBe('active');
  });
});

describe('shiftFormSchema', () => {
  it('rejects an empty name', () => {
    const result = shiftFormSchema.safeParse({
      ...EMPTY_SHIFT_FORM,
      name: ''
    });
    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 200 characters', () => {
    const result = shiftFormSchema.safeParse({
      ...EMPTY_SHIFT_FORM,
      name: 'a'.repeat(201)
    });
    expect(result.success).toBe(false);
  });

  it('rejects time strings in non-HH:MM format', () => {
    const result = shiftFormSchema.safeParse({
      ...EMPTY_SHIFT_FORM,
      name: 'X',
      startTime: '8am'
    });
    expect(result.success).toBe(false);
  });

  it('rejects a color that does not match the hex preset regex', () => {
    const result = shiftFormSchema.safeParse({
      ...EMPTY_SHIFT_FORM,
      color: 'red'
    });
    expect(result.success).toBe(false);
  });

  it('accepts a hex color in lowercase', () => {
    const result = shiftFormSchema.safeParse({
      ...EMPTY_SHIFT_FORM,
      name: 'X',
      color: '#0ea5e9'
    });
    expect(result.success).toBe(true);
  });

  it('accepts the defaults with a valid name', () => {
    const result = shiftFormSchema.safeParse({ ...EMPTY_SHIFT_FORM, name: 'Morning' });
    expect(result.success).toBe(true);
  });

  it('rejects the bare empty form (name is required)', () => {
    const result = shiftFormSchema.safeParse(EMPTY_SHIFT_FORM);
    expect(result.success).toBe(false);
  });
});

describe('shiftFormToPayload', () => {
  it('coerces string form fields to numbers for the server payload', () => {
    const { withBreakWindow } = shiftFormToPayload({
      ...EMPTY_SHIFT_FORM,
      name: '  Morning  ',
      lateToleranceMinutes: '7',
      absenceCutoffMinutes: '90'
    });
    expect(withBreakWindow.name).toBe('Morning');
    expect(withBreakWindow.lateToleranceMinutes).toBe(7);
    expect(withBreakWindow.absenceCutoffMinutes).toBe(90);
  });

  it('drops the break window when start/end are empty', () => {
    const { withBreakWindow } = shiftFormToPayload(EMPTY_SHIFT_FORM);
    expect(withBreakWindow.breakStart).toBeNull();
    expect(withBreakWindow.breakEnd).toBeNull();
    expect(withBreakWindow.maxBreakMinutes).toBeNull();
  });

  it('keeps the break window when both start and end are set', () => {
    const { withBreakWindow } = shiftFormToPayload({
      ...EMPTY_SHIFT_FORM,
      breakStart: '12:00',
      breakEnd: '13:00',
      maxBreakMinutes: '60'
    });
    expect(withBreakWindow.breakStart).toBe('12:00');
    expect(withBreakWindow.breakEnd).toBe('13:00');
    expect(withBreakWindow.maxBreakMinutes).toBe(60);
  });

  it('passes status through untouched', () => {
    const inactive = shiftFormToPayload({ ...EMPTY_SHIFT_FORM, status: 'inactive' });
    expect(inactive.status).toBe('inactive');
  });

  it('trims whitespace from note and treats empty as null', () => {
    expect(
      shiftFormToPayload({ ...EMPTY_SHIFT_FORM, note: '   ' }).withBreakWindow.note
    ).toBeNull();
    expect(shiftFormToPayload({ ...EMPTY_SHIFT_FORM, note: 'office' }).withBreakWindow.note).toBe(
      'office'
    );
  });

  it('nulls out weekday times on non-working days', () => {
    const { withBreakWindow } = shiftFormToPayload({
      ...EMPTY_SHIFT_FORM,
      weekdayRules: ALL_DAYS.map((dayOfWeek) => ({
        dayOfWeek,
        isWorkingDay: false,
        startTime: '08:00',
        endTime: '17:00'
      }))
    });
    expect(withBreakWindow.weekdayRules.every((r) => r.startTime === null)).toBe(true);
    expect(withBreakWindow.weekdayRules.every((r) => r.endTime === null)).toBe(true);
  });
});
