import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the functions from service
import {
  createNationalHolidayFn,
  getNationalHolidaysFn,
  getNationalHolidayFn,
  updateNationalHolidayFn,
  deleteNationalHolidayFn,
  importHolidaysFromApiFn,
  mapHolidayResponse
} from './service';

// Mock the DB functions
const mockGetNationalHolidays = vi.fn(() => Promise.resolve({ success: true, holidays: [] }));
const mockGetNationalHoliday = vi.fn(() => Promise.resolve({ success: true, holiday: null }));
const mockCreateNationalHoliday = vi.fn(() =>
  Promise.resolve({ success: true, holiday: { id: 1, date: '2026-01-01', name: 'Test Holiday' } })
);
const mockUpdateNationalHoliday = vi.fn(() =>
  Promise.resolve({ success: true, holiday: { id: 1, name: 'Updated' } })
);
const mockDeleteNationalHoliday = vi.fn(() => Promise.resolve({ success: true }));

vi.mock('@/lib/db/attendance', () => ({
  getNationalHolidays: mockGetNationalHolidays,
  getNationalHoliday: mockGetNationalHoliday,
  createNationalHoliday: mockCreateNationalHoliday,
  updateNationalHoliday: mockUpdateNationalHoliday,
  deleteNationalHoliday: mockDeleteNationalHoliday
}));

// Mock auth session
const mockRequirePermission = vi.fn(() =>
  Promise.resolve({ user: { id: 'user-1', role: 'admin' } })
);
vi.mock('@/lib/auth/session', () => ({
  requirePermission: mockRequirePermission
}));

describe('Holiday Calendar Server Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('mapHolidayResponse', () => {
    it('should map Nager.Date records', () => {
      const payload = [
        { date: '2026-01-01', localName: 'New Year', name: 'New Year', countryCode: 'ID' },
        {
          date: '2026-08-17',
          localName: 'Independence Day',
          name: 'Independence Day',
          countryCode: 'ID'
        }
      ];
      const records = mapHolidayResponse(payload, 'nager_date');
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({
        date: '2026-01-01',
        name: 'New Year',
        description: null
      });
    });

    it('should use name string as fallback when localName is missing', () => {
      const payload = [{ date: '2026-05-01', name: 'Labour Day', countryCode: 'ID' }];
      const records = mapHolidayResponse(payload, 'nager_date');
      expect(records[0].name).toBe('Labour Day');
    });

    it('should skip records without a valid date or name', () => {
      const payload = [
        { localName: 'No Date', name: 'Whatever' },
        { date: '2026-01-01' },
        { date: '2026-01-01', name: 'Valid' }
      ];
      const records = mapHolidayResponse(payload, 'nager_date');
      expect(records).toHaveLength(1);
      expect(records[0].name).toBe('Valid');
    });

    it('should map OpenHolidays records', () => {
      const payload = [
        {
          startDate: '2026-01-01',
          name: [
            { language: 'ID', text: 'Tahun Baru' },
            { language: 'EN', text: 'New Year' }
          ]
        }
      ];
      const records = mapHolidayResponse(payload, 'openholidays');
      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ date: '2026-01-01', name: 'New Year', description: null });
    });

    it('should map OpenHolidays records with a non-English first name', () => {
      const payload = [
        {
          startDate: '2026-08-17',
          name: [{ language: 'ID', text: 'Hari Kemerdekaan' }]
        }
      ];
      const records = mapHolidayResponse(payload, 'openholidays');
      expect(records[0].name).toBe('Hari Kemerdekaan');
    });

    it('should map custom records using response mapping', () => {
      const payload = {
        data: [
          { when: '2026-02-10T00:00:00Z', title: 'Custom Day', note: 'A special day' },
          { when: '2026-03-15', title: 'Another Day', note: 'Another note' }
        ]
      };
      const records = mapHolidayResponse(payload, 'custom', {
        date: 'when',
        name: 'title',
        description: 'note'
      });
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({
        date: '2026-02-10',
        name: 'Custom Day',
        description: 'A special day'
      });
    });

    it('should fall back to default fields when no mapping is provided', () => {
      const payload = [{ date: '2026-04-01', name: 'Plain', description: 'Desc' }];
      const records = mapHolidayResponse(payload, 'custom');
      expect(records[0]).toEqual({ date: '2026-04-01', name: 'Plain', description: 'Desc' });
    });
  });
});
