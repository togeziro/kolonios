import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { withAudit } from '@/lib/audit';
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
  importHolidaysSchema,
  updateHolidayApiSettingsSchema
} from './validation';

// Create National Holiday Server Function
export const createNationalHolidayFn = createServerFn({ method: 'POST' })
  .validator(createNationalHolidaySchema)
  .handler(async ({ data }) => {
    await requirePermission('holiday', 'add');

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
    await requirePermission('holiday', 'edit');

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
    await requirePermission('holiday', 'delete');

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

const NAGER_DATE_DEFAULT_URL = 'https://date.nager.at/api/v3/PublicHolidays';
const OPENHOLIDAYS_DEFAULT_URL = 'https://openholidaysapi.org/PublicHolidays';
const DEFAULT_COUNTRY_CODE = 'ID';
const DEFAULT_RESPONSE_LANGUAGE = 'EN';

export interface ImportedHolidayRecord {
  date: string;
  name: string;
  description?: string | null;
}

function trimTrailingSlash(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function getFieldPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

function toDateString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function toDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 ? name.slice(0, 200) : null;
}

function toDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const description = value.trim();
  return description.length > 0 ? description.slice(0, 500) : null;
}

function mapNagerDateRecord(record: unknown): ImportedHolidayRecord | null {
  if (!record || typeof record !== 'object') return null;
  const item = record as Record<string, unknown>;
  const date = toDateString(item.date);
  const localName = toDisplayName(item.localName);
  const name = toDisplayName(item.name);
  if (!date || (!localName && !name)) return null;
  const displayName = localName ?? (name as string);
  const description = name && name !== displayName ? name : null;
  return { date, name: displayName, description };
}

function mapOpenHolidaysRecord(record: unknown): ImportedHolidayRecord | null {
  if (!record || typeof record !== 'object') return null;
  const item = record as Record<string, unknown>;
  const date = toDateString(item.startDate);
  const names = Array.isArray(item.name) ? (item.name as Record<string, unknown>[]) : [];
  let displayName: string | null = null;
  for (const entry of names) {
    const text = toDisplayName(entry.text);
    if (text) {
      displayName = text;
      if (String(entry.language).toUpperCase() === DEFAULT_RESPONSE_LANGUAGE) break;
    }
  }
  if (!date || !displayName) return null;
  return { date, name: displayName, description: null };
}

function mapCustomRecord(
  record: unknown,
  mapping: Record<string, string>
): ImportedHolidayRecord | null {
  if (!record || typeof record !== 'object') return null;
  const date = toDateString(getFieldPath(record, mapping.date || 'date'));
  const name = toDisplayName(getFieldPath(record, mapping.name || 'name'));
  if (!date || !name) return null;
  const description = toDescription(getFieldPath(record, mapping.description || 'description'));
  return { date, name, description };
}

export function mapHolidayResponse(
  payload: unknown,
  provider: string,
  mapping?: Record<string, string> | null
): ImportedHolidayRecord[] {
  let items: unknown[] = [];
  if (Array.isArray(payload)) {
    items = payload;
  } else if (payload && typeof payload === 'object') {
    const object = payload as Record<string, unknown>;
    for (const key of ['data', 'holidays', 'items']) {
      if (Array.isArray(object[key])) {
        items = object[key] as unknown[];
        break;
      }
    }
  }

  const normalizedMapping = mapping && typeof mapping === 'object' ? mapping : {};

  const records: ImportedHolidayRecord[] = [];
  for (const item of items) {
    let record: ImportedHolidayRecord | null = null;
    if (provider === 'nager_date') {
      record = mapNagerDateRecord(item);
    } else if (provider === 'openholidays') {
      record = mapOpenHolidaysRecord(item);
    } else {
      record = mapCustomRecord(item, normalizedMapping);
    }
    if (record) records.push(record);
  }
  return records;
}

function buildCustomHolidayUrl(
  baseUrl: string,
  { year, countryCode }: { year: number; countryCode: string }
): URL {
  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    throw new DomainError('Holiday API URL is invalid', 'HOLIDAY_IMPORT_FAILED');
  }
  if (!url.searchParams.has('year')) url.searchParams.set('year', String(year));
  if (!url.searchParams.has('countryCode')) url.searchParams.set('countryCode', countryCode);
  return url;
}

async function fetchHolidayPayload(
  provider: string,
  config: {
    url: string;
    apiKey?: string | null;
    countryCode: string;
    year: number;
    headers?: Record<string, string> | null;
  }
): Promise<unknown> {
  const { url, apiKey, countryCode, year, headers } = config;
  let response: Response;

  if (provider === 'nager_date') {
    const target = `${trimTrailingSlash(url || NAGER_DATE_DEFAULT_URL)}/${year}/${encodeURIComponent(
      countryCode
    )}`;
    response = await fetch(target);
  } else if (provider === 'openholidays') {
    const target = new URL(trimTrailingSlash(url || OPENHOLIDAYS_DEFAULT_URL));
    target.searchParams.set('countryIsoCode', countryCode);
    target.searchParams.set('languageIsoCode', DEFAULT_RESPONSE_LANGUAGE);
    target.searchParams.set('validFrom', `${year}-01-01`);
    target.searchParams.set('validTo', `${year}-12-31`);
    response = await fetch(target, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {})
      }
    });
  } else {
    const target = buildCustomHolidayUrl(url, { year, countryCode });
    const requestHeaders: Record<string, string> = { ...headers };
    if (apiKey && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === 'x-api-key')) {
      requestHeaders['X-API-Key'] = apiKey;
    }
    response = await fetch(target, { headers: requestHeaders });
  }

  if (!response.ok) {
    throw new DomainError(
      `Holiday API request failed (${response.status})`,
      'HOLIDAY_IMPORT_FAILED'
    );
  }

  try {
    return await response.json();
  } catch {
    throw new DomainError('Holiday API returned an invalid response', 'HOLIDAY_IMPORT_FAILED');
  }
}

// Import Holidays from API Server Function
export const importHolidaysFromApiFn = createServerFn({ method: 'POST' })
  .validator(importHolidaysSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('holiday', 'add');
    await checkRateLimit(`write:${session.user.id}`);

    try {
      const { getCompanySettings } = await import('@/lib/db/masterdata');
      const settingsResult = await getCompanySettings();

      if (!settingsResult?.success || !settingsResult.settings) {
        throw new DomainError(
          'Holiday API settings not configured',
          'HOLIDAY_SETTINGS_NOT_CONFIGURED'
        );
      }

      const settings = settingsResult.settings;
      const provider = settings.holiday_api_provider || 'nager_date';
      const countryCode = settings.holiday_api_country_code?.trim() || DEFAULT_COUNTRY_CODE;

      const payload = await fetchHolidayPayload(provider, {
        url: settings.holiday_api_url ?? '',
        apiKey: settings.holiday_api_key,
        countryCode,
        year: data.year,
        headers: settings.holiday_api_headers
      });

      const records = mapHolidayResponse(payload, provider, settings.holiday_api_response_mapping);

      const existingResult = await getNationalHolidays(data.year);
      const existingDates = new Set(
        existingResult.success ? existingResult.holidays.map((holiday) => holiday.date) : []
      );

      let count = 0;
      for (const record of records) {
        if (existingDates.has(record.date)) continue;
        existingDates.add(record.date);

        const created = await createNationalHoliday({
          date: record.date,
          name: record.name,
          description: record.description ?? null,
          is_recurring: false,
          year: data.year,
          source: 'imported',
          is_override: false
        });

        if (created.success) count += 1;
      }

      return { success: true, count };
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError('Failed to import holidays', 'HOLIDAY_IMPORT_FAILED');
    }
  });

// Get Holiday API Settings Server Function
export const getHolidayApiSettingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePermission('holiday', 'view');
  const { getCompanySettings } = await import('@/lib/db/masterdata');
  return getCompanySettings();
});

// Update Holiday API Settings Server Function
export const updateHolidayApiSettingsFn = createServerFn({ method: 'POST' })
  .validator(updateHolidayApiSettingsSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('holiday', 'edit');
    await checkRateLimit(`write:${session.user.id}`);
    const { updateCompanySettings } = await import('@/lib/db/masterdata');

    const result = await updateCompanySettings({
      holiday_api_provider: data.provider,
      holiday_api_url: data.url || null,
      holiday_api_key: data.api_key || null,
      holiday_api_country_code: data.country_code
    });

    await withAudit(
      session.user.id,
      {
        action: 'holiday.settings.update',
        entityType: 'company_settings',
        entityId: '1',
        before: null,
        after: {
          ...result,
          settings: result.settings
            ? { ...result.settings, holiday_api_key: undefined }
            : result.settings
        }
      },
      async () => undefined
    );

    return result;
  });
