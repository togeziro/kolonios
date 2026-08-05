// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Import the functions from service
import {
  createNationalHolidayFn,
  getNationalHolidaysFn,
  getNationalHolidayFn,
  updateNationalHolidayFn,
  deleteNationalHolidayFn,
  importHolidaysFromApiFn
} from './service';

// Mock the DB functions
const mockGetNationalHolidays = mock(() => Promise.resolve({ success: true, holidays: [] }));
const mockGetNationalHoliday = mock(() => Promise.resolve({ success: true, holiday: null }));
const mockCreateNationalHoliday = mock(() =>
  Promise.resolve({ success: true, holiday: { id: 1, date: '2026-01-01', name: 'Test Holiday' } })
);
const mockUpdateNationalHoliday = mock(() =>
  Promise.resolve({ success: true, holiday: { id: 1, name: 'Updated' } })
);
const mockDeleteNationalHoliday = mock(() => Promise.resolve({ success: true }));

mock.module('@/lib/db/attendance', () => ({
  getNationalHolidays: mockGetNationalHolidays,
  getNationalHoliday: mockGetNationalHoliday,
  createNationalHoliday: mockCreateNationalHoliday,
  updateNationalHoliday: mockUpdateNationalHoliday,
  deleteNationalHoliday: mockDeleteNationalHoliday
}));

// Mock auth session
const mockRequirePermission = mock(() =>
  Promise.resolve({ user: { id: 'user-1', role: 'admin' } })
);
mock.module('@/lib/auth/session', () => ({
  requirePermission: mockRequirePermission
}));

describe('Holiday Calendar Server Functions', () => {
  beforeEach(() => {
    mock.restore();
    mockGetNationalHolidays.mockClear();
    mockGetNationalHoliday.mockClear();
    mockCreateNationalHoliday.mockClear();
    mockUpdateNationalHoliday.mockClear();
    mockDeleteNationalHoliday.mockClear();
    mockRequirePermission.mockClear();
  });

  describe('Function Exports', () => {
    it('should export createNationalHolidayFn', () => {
      expect(createNationalHolidayFn).toBeDefined();
    });

    it('should export getNationalHolidaysFn', () => {
      expect(getNationalHolidaysFn).toBeDefined();
    });

    it('should export getNationalHolidayFn', () => {
      expect(getNationalHolidayFn).toBeDefined();
    });

    it('should export updateNationalHolidayFn', () => {
      expect(updateNationalHolidayFn).toBeDefined();
    });

    it('should export deleteNationalHolidayFn', () => {
      expect(deleteNationalHolidayFn).toBeDefined();
    });

    it('should export importHolidaysFromApiFn', () => {
      expect(importHolidaysFromApiFn).toBeDefined();
    });
  });
});
