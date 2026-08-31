import { describe, expect, it } from 'vitest';
import {
  attendanceCheckInSchema,
  attendanceCheckOutSchema,
  attendanceFiltersSchema,
  dateParamSchema,
  leaveRequestSchema,
  leaveFiltersSchema,
  leaveTypeSchema,
  leaveStatusSchema,
  locationCreateSchema,
  locationUpdateSchema,
  bulkAssignmentSchema,
  correctionRequestSchema,
  correctionReviewSchema,
  reportFiltersSchema,
  exportFormatSchema
} from './validation';

describe('attendanceCheckInSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(attendanceCheckInSchema.safeParse({}).success).toBe(true);
  });

  it('validates shiftId as positive integer', () => {
    expect(attendanceCheckInSchema.safeParse({ shiftId: 1 }).success).toBe(true);
    expect(attendanceCheckInSchema.safeParse({ shiftId: 0 }).success).toBe(false);
    expect(attendanceCheckInSchema.safeParse({ shiftId: -1 }).success).toBe(false);
    expect(attendanceCheckInSchema.safeParse({ shiftId: 1.5 }).success).toBe(false);
  });

  it('validates latitude range', () => {
    expect(attendanceCheckInSchema.safeParse({ latitude: 0 }).success).toBe(true);
    expect(attendanceCheckInSchema.safeParse({ latitude: 90 }).success).toBe(true);
    expect(attendanceCheckInSchema.safeParse({ latitude: -90 }).success).toBe(true);
    expect(attendanceCheckInSchema.safeParse({ latitude: 91 }).success).toBe(false);
    expect(attendanceCheckInSchema.safeParse({ latitude: -91 }).success).toBe(false);
  });

  it('validates longitude range', () => {
    expect(attendanceCheckInSchema.safeParse({ longitude: 180 }).success).toBe(true);
    expect(attendanceCheckInSchema.safeParse({ longitude: -180 }).success).toBe(true);
    expect(attendanceCheckInSchema.safeParse({ longitude: 181 }).success).toBe(false);
    expect(attendanceCheckInSchema.safeParse({ longitude: -181 }).success).toBe(false);
  });

  it('validates note max length', () => {
    expect(attendanceCheckInSchema.safeParse({ note: 'x'.repeat(500) }).success).toBe(true);
    expect(attendanceCheckInSchema.safeParse({ note: 'x'.repeat(501) }).success).toBe(false);
  });

  it('validates lateDuration as non-negative', () => {
    expect(attendanceCheckInSchema.safeParse({ lateDuration: 0 }).success).toBe(true);
    expect(attendanceCheckInSchema.safeParse({ lateDuration: 10 }).success).toBe(true);
    expect(attendanceCheckInSchema.safeParse({ lateDuration: -5 }).success).toBe(false);
  });
});

describe('attendanceCheckOutSchema', () => {
  it('requires attendanceId as positive integer', () => {
    expect(attendanceCheckOutSchema.safeParse({ attendanceId: 1 }).success).toBe(true);
    expect(attendanceCheckOutSchema.safeParse({}).success).toBe(false);
    expect(attendanceCheckOutSchema.safeParse({ attendanceId: 0 }).success).toBe(false);
    expect(attendanceCheckOutSchema.safeParse({ attendanceId: -1 }).success).toBe(false);
  });

  it('validates optional fields', () => {
    const res = attendanceCheckOutSchema.safeParse({
      attendanceId: 1,
      latitude: 40.7128,
      longitude: -74.006,
      earlyOutDuration: 30,
      photo: 'photo.jpg',
      note: 'Left early'
    });
    expect(res.success).toBe(true);
  });
});

describe('attendanceFiltersSchema', () => {
  it('accepts empty object', () => {
    expect(attendanceFiltersSchema.safeParse({}).success).toBe(true);
  });

  it('coerces page and limit to numbers from strings', () => {
    const res = attendanceFiltersSchema.safeParse({ page: '2', limit: '50' });
    expect(res.success).toBe(true);
    expect(res.data!.page).toBe(2);
    expect(res.data!.limit).toBe(50);
  });

  it('validates limit max is 100', () => {
    expect(attendanceFiltersSchema.safeParse({ limit: 100 }).success).toBe(true);
    expect(attendanceFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('validates month range 1-12', () => {
    expect(attendanceFiltersSchema.safeParse({ month: 1 }).success).toBe(true);
    expect(attendanceFiltersSchema.safeParse({ month: 12 }).success).toBe(true);
    expect(attendanceFiltersSchema.safeParse({ month: 0 }).success).toBe(false);
    expect(attendanceFiltersSchema.safeParse({ month: 13 }).success).toBe(false);
  });
});

describe('dateParamSchema', () => {
  it('accepts a string or nothing', () => {
    expect(dateParamSchema.parse('2026-07-31')).toBe('2026-07-31');
    expect(dateParamSchema.parse(undefined)).toBeUndefined();
  });
});

describe('leaveTypeSchema', () => {
  it('accepts valid leave types', () => {
    for (const t of ['annual', 'sick', 'personal', 'emergency', 'maternity', 'paternity']) {
      expect(leaveTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it('rejects invalid leave types', () => {
    expect(leaveTypeSchema.safeParse('vacation').success).toBe(false);
    expect(leaveTypeSchema.safeParse('').success).toBe(false);
  });
});

describe('leaveStatusSchema', () => {
  it('accepts valid statuses', () => {
    for (const s of ['pending', 'approved', 'rejected', 'cancelled']) {
      expect(leaveStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it('rejects invalid statuses', () => {
    expect(leaveStatusSchema.safeParse('draft').success).toBe(false);
  });
});

describe('leaveRequestSchema', () => {
  it('requires leaveType, startDate and endDate', () => {
    expect(
      leaveRequestSchema.safeParse({
        leaveType: 'annual',
        startDate: '2026-08-01',
        endDate: '2026-08-05'
      }).success
    ).toBe(true);
  });

  it('rejects invalid date format', () => {
    expect(
      leaveRequestSchema.safeParse({
        leaveType: 'annual',
        startDate: '01-08-2026',
        endDate: '2026-08-05'
      }).success
    ).toBe(false);

    expect(
      leaveRequestSchema.safeParse({
        leaveType: 'annual',
        startDate: 'not-a-date',
        endDate: '2026-08-05'
      }).success
    ).toBe(false);
  });

  it('validates reason max length 1000', () => {
    const base = { leaveType: 'annual' as const, startDate: '2026-08-01', endDate: '2026-08-05' };
    expect(leaveRequestSchema.safeParse({ ...base, reason: 'x'.repeat(1000) }).success).toBe(true);
    expect(leaveRequestSchema.safeParse({ ...base, reason: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('requires all fields when present', () => {
    const res = leaveRequestSchema.safeParse({
      leaveType: 'sick',
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      reason: 'Not feeling well',
      file: 'doctor_note.pdf'
    });
    expect(res.success).toBe(true);
  });
});

describe('leaveFiltersSchema', () => {
  it('accepts empty object', () => {
    expect(leaveFiltersSchema.safeParse({}).success).toBe(true);
  });

  it('validates optional status and leaveType', () => {
    expect(leaveFiltersSchema.safeParse({ status: 'pending' }).success).toBe(true);
    expect(leaveFiltersSchema.safeParse({ leaveType: 'annual' }).success).toBe(true);
    expect(leaveFiltersSchema.safeParse({ status: 'invalid' }).success).toBe(false);
  });
});

describe('locationCreateSchema', () => {
  it('requires name and accepts valid coordinates/policy', () => {
    expect(locationCreateSchema.safeParse({ name: 'Office' }).success).toBe(true);
    expect(locationCreateSchema.safeParse({}).success).toBe(false);
  });

  it('validates coordinate ranges', () => {
    const base = { name: 'Office' };
    expect(locationCreateSchema.safeParse({ ...base, latitude: -90, longitude: 180 }).success).toBe(
      true
    );
    expect(locationCreateSchema.safeParse({ ...base, latitude: 91 }).success).toBe(false);
    expect(locationCreateSchema.safeParse({ ...base, longitude: -181 }).success).toBe(false);
  });

  it('validates positive radius and policy limits', () => {
    const base = { name: 'Office' };
    expect(locationCreateSchema.safeParse({ ...base, radius: 100 }).success).toBe(true);
    expect(locationCreateSchema.safeParse({ ...base, radius: 0 }).success).toBe(false);
    expect(locationCreateSchema.safeParse({ ...base, maxAccuracyMeters: 50 }).success).toBe(true);
    expect(locationCreateSchema.safeParse({ ...base, maxAccuracyMeters: 0 }).success).toBe(false);
    expect(locationCreateSchema.safeParse({ ...base, maxStaleMs: 0 }).success).toBe(false);
  });
});

describe('locationUpdateSchema', () => {
  it('requires an id', () => {
    expect(locationUpdateSchema.safeParse({}).success).toBe(false);
    expect(locationUpdateSchema.safeParse({ id: 1, name: 'New' }).success).toBe(true);
  });

  it('validates optional policy toggles', () => {
    expect(
      locationUpdateSchema.safeParse({ id: 1, gpsValidationEnabled: false, selfieRequired: true })
        .success
    ).toBe(true);
  });
});

describe('bulkAssignmentSchema', () => {
  it('requires at least one assignment', () => {
    expect(bulkAssignmentSchema.safeParse({ assignments: [] }).success).toBe(false);
    expect(
      bulkAssignmentSchema.safeParse({
        assignments: [{ userId: 'u1', shiftId: 1, effectiveFrom: '2026-08-01' }]
      }).success
    ).toBe(true);
  });

  it('validates each assignment', () => {
    expect(
      bulkAssignmentSchema.safeParse({
        assignments: [{ userId: '', shiftId: 1, effectiveFrom: '2026-08-01' }]
      }).success
    ).toBe(false);
  });
});

describe('correctionRequestSchema', () => {
  it('requires attendanceId and at least one requested time or note', () => {
    expect(correctionRequestSchema.safeParse({ attendanceId: 1 }).success).toBe(false);
    expect(
      correctionRequestSchema.safeParse({ attendanceId: 1, requestedCheckInTime: '09:00' }).success
    ).toBe(true);
    expect(
      correctionRequestSchema.safeParse({ attendanceId: 1, note: 'Forgot to check in' }).success
    ).toBe(true);
  });

  it('validates time format and note length', () => {
    expect(
      correctionRequestSchema.safeParse({ attendanceId: 1, requestedCheckInTime: '9:00' }).success
    ).toBe(false);
    expect(
      correctionRequestSchema.safeParse({ attendanceId: 1, note: 'x'.repeat(1001) }).success
    ).toBe(false);
  });
});

describe('correctionReviewSchema', () => {
  it('requires attendanceId, decision, and reason', () => {
    expect(correctionReviewSchema.safeParse({}).success).toBe(false);
    expect(
      correctionReviewSchema.safeParse({ attendanceId: 1, decision: 'approve', reason: 'OK' })
        .success
    ).toBe(true);
    expect(correctionReviewSchema.safeParse({ attendanceId: 1, decision: 'approve' }).success).toBe(
      false
    );
  });

  it('validates decision enum', () => {
    expect(
      correctionReviewSchema.safeParse({ attendanceId: 1, decision: 'maybe', reason: 'x' }).success
    ).toBe(false);
  });
});

describe('reportFiltersSchema', () => {
  it('accepts empty object', () => {
    expect(reportFiltersSchema.safeParse({}).success).toBe(true);
  });

  it('validates date range and pagination', () => {
    expect(
      reportFiltersSchema.safeParse({ startDate: '2026-08-01', endDate: '2026-08-31' }).success
    ).toBe(true);
    expect(reportFiltersSchema.safeParse({ startDate: '2026/08/01' }).success).toBe(false);
    expect(reportFiltersSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe('exportFormatSchema', () => {
  it('accepts csv, xlsx, pdf only', () => {
    expect(exportFormatSchema.safeParse('csv').success).toBe(true);
    expect(exportFormatSchema.safeParse('xlsx').success).toBe(true);
    expect(exportFormatSchema.safeParse('pdf').success).toBe(true);
    expect(exportFormatSchema.safeParse('html').success).toBe(false);
  });
});
