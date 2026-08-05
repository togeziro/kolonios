import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import {
  getNationalHolidays,
  getNationalHoliday,
  createNationalHoliday,
  updateNationalHoliday,
  deleteNationalHoliday
} from '@/lib/db/attendance';
import {
  createNationalHolidaySchema,
  updateNationalHolidaySchema,
  deleteNationalHolidaySchema,
  getNationalHolidaysSchema,
  importHolidaysSchema
} from './validation';

// Create National Holiday Server Function
export const createNationalHolidayFn = createServerFn({ method: 'POST' })
  .validator(createNationalHolidaySchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('holiday', 'add');

    try {
      const result = await createNationalHoliday({
        date: data.date,
        name: data.name,
        description: data.description ?? null,
        is_recurring: data.is_recurring ?? false,
        year: data.year ?? null,
        source: data.source ?? 'manual',
        is_override: data.is_override ?? false
      });

      if (!result.success) {
        throw new DomainError('Failed to create holiday', 'HOLIDAY_CREATE_FAILED');
      }

      return { success: true, holiday: result.holiday };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('Failed to create holiday', 'HOLIDAY_CREATE_FAILED');
    }
  });

// Get National Holidays Server Function
export const getNationalHolidaysFn = createServerFn({ method: 'GET' })
  .validator(getNationalHolidaysSchema)
  .handler(async ({ data }) => {
    await requirePermission('holiday', 'view');

    try {
      const result = await getNationalHolidays(data.year);

      if (!result.success) {
        throw new DomainError('Failed to fetch holidays', 'HOLIDAY_FETCH_FAILED');
      }

      return { success: true, holidays: result.holidays };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('Failed to fetch holidays', 'HOLIDAY_FETCH_FAILED');
    }
  });

// Get Single National Holiday Server Function
export const getNationalHolidayFn = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requirePermission('holiday', 'view');

    try {
      const result = await getNationalHoliday(data.id);

      if (!result.success || !result.holiday) {
        throw new DomainError('Holiday not found', 'HOLIDAY_NOT_FOUND');
      }

      return { success: true, holiday: result.holiday };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('Failed to fetch holiday', 'HOLIDAY_FETCH_FAILED');
    }
  });

// Update National Holiday Server Function
export const updateNationalHolidayFn = createServerFn({ method: 'POST' })
  .validator(updateNationalHolidaySchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('holiday', 'edit');

    try {
      const result = await updateNationalHoliday(data.id, data.data);

      if (!result.success) {
        throw new DomainError('Failed to update holiday', 'HOLIDAY_UPDATE_FAILED');
      }

      return { success: true, holiday: result.holiday };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('Failed to update holiday', 'HOLIDAY_UPDATE_FAILED');
    }
  });

// Delete National Holiday Server Function
export const deleteNationalHolidayFn = createServerFn({ method: 'POST' })
  .validator(deleteNationalHolidaySchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('holiday', 'delete');

    try {
      const result = await deleteNationalHoliday(data.id);

      if (!result.success) {
        throw new DomainError('Failed to delete holiday', 'HOLIDAY_DELETE_FAILED');
      }

      return { success: true };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('Failed to delete holiday', 'HOLIDAY_DELETE_FAILED');
    }
  });

// Import Holidays from API Server Function
export const importHolidaysFromApiFn = createServerFn({ method: 'POST' })
  .validator(importHolidaysSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('holiday', 'add');

    try {
      // TODO: Implement actual API import logic
      // For now, return a placeholder response
      // This will be implemented in a future task

      throw new DomainError('Import from API not yet implemented', 'NOT_IMPLEMENTED');
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('Failed to import holidays', 'HOLIDAY_IMPORT_FAILED');
    }
  });
