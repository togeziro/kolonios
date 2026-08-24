import { createServerFn } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { requirePermission } from '@/lib/auth/session';
import { DomainError } from '@/lib/errors';
import { employeeTaxRecords } from '@/lib/db/schema/payroll';
import { getEffectiveTaxProfile, withPayrollAuditTransaction } from '@/lib/db/payroll';
import { toMinor } from '../utils/money';
import type { TaxProfile } from './types';
import { taxRecordOverrideSchema } from './validation';

function parseTaxRate(value: unknown, name: string) {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+(?:\.\d+)?$/.test(text))
    throw new DomainError(`Invalid tax rate: ${name}`, 'INVALID_TAX_RATE');
  const rate = Number(text);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100)
    throw new DomainError(`Invalid tax rate: ${name}`, 'INVALID_TAX_RATE');
  return rate;
}

function parseTaxMoney(value: unknown, name: string) {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new DomainError(`Invalid tax amount: ${name}`, 'INVALID_TAX_AMOUNT');
  try {
    return toMinor(value);
  } catch {
    throw new DomainError(`Invalid tax amount: ${name}`, 'INVALID_TAX_AMOUNT');
  }
}

export function mapTaxProfile(
  profile: Awaited<ReturnType<typeof getEffectiveTaxProfile>>,
  setting: { rates: unknown } | null
): TaxProfile {
  const rates = setting?.rates;
  if (rates == null || typeof rates !== 'object' || Array.isArray(rates)) {
    if (!setting) return { method: 'none', ptkp: 0, settings: {} };
    throw new DomainError('Invalid tax settings JSON', 'INVALID_TAX_SETTINGS');
  }
  const raw = rates as Record<string, unknown>;
  const method = raw.method;
  if (method !== 'none' && method !== 'progressive' && method !== 'ter')
    throw new DomainError('Invalid tax method', 'INVALID_TAX_METHOD');
  const progressive = raw.progressive;
  const parsedProgressive =
    progressive == null
      ? undefined
      : (() => {
          if (!Array.isArray(progressive))
            throw new DomainError('Invalid progressive tax brackets', 'INVALID_TAX_BRACKETS');
          return progressive.map((bracket, index) => {
            if (!bracket || typeof bracket !== 'object' || Array.isArray(bracket))
              throw new DomainError(`Invalid progressive bracket: ${index}`, 'INVALID_TAX_BRACKET');
            const item = bracket as Record<string, unknown>;
            return {
              upTo:
                item.upTo == null ? null : parseTaxMoney(item.upTo, `progressive[${index}].upTo`),
              rate: parseTaxRate(item.rate, `progressive[${index}].rate`)
            };
          });
        })();
  const ter = raw.ter;
  const parsedTer =
    ter == null
      ? undefined
      : (() => {
          if (typeof ter !== 'object' || Array.isArray(ter))
            throw new DomainError('Invalid TER tax categories', 'INVALID_TER_CATEGORIES');
          return Object.fromEntries(
            Object.entries(ter).map(([category, brackets]) => {
              if (!category.trim() || !Array.isArray(brackets))
                throw new DomainError(`Invalid TER category: ${category}`, 'INVALID_TER_CATEGORY');
              return [
                category,
                brackets.map((bracket, index) => {
                  if (!bracket || typeof bracket !== 'object' || Array.isArray(bracket))
                    throw new DomainError(
                      `Invalid TER bracket: ${category}[${index}]`,
                      'INVALID_TER_BRACKET'
                    );
                  const item = bracket as Record<string, unknown>;
                  return {
                    upTo:
                      item.upTo == null
                        ? null
                        : parseTaxMoney(item.upTo, `ter.${category}[${index}].upTo`),
                    rate: parseTaxRate(item.rate, `ter.${category}[${index}].rate`)
                  };
                })
              ];
            })
          );
        })();
  const ptkp =
    method === 'none' ? parseTaxMoney(raw.ptkp ?? '0', 'ptkp') : parseTaxMoney(raw.ptkp, 'ptkp');
  const category = profile.filing_status ?? undefined;
  if (method === 'ter' && parsedTer && category && !parsedTer[category])
    throw new DomainError(`Missing TER category: ${category}`, 'INVALID_TAX_SETTINGS');
  return { method, ptkp, category, settings: { progressive: parsedProgressive, ter: parsedTer } };
}

export const overrideEmployeeTaxRecordFn = createServerFn({ method: 'POST' })
  .validator(taxRecordOverrideSchema)
  .handler(async ({ data }) => {
    const session = await requirePermission('payroll', 'edit');
    return withPayrollAuditTransaction(
      session.user.id,
      {
        action: 'payroll.tax_record.override',
        entityType: 'employee_tax_record',
        entityId: data.id
      },
      async (tx) => {
        const [row] = await tx
          .update(employeeTaxRecords)
          .set({ tax_amount: data.amount, source: 'manual', is_overridden: true })
          .where(eq(employeeTaxRecords.id, data.id))
          .returning();
        if (!row) throw new DomainError('Tax record was not found.', 'TAX_RECORD_NOT_FOUND');
        return JSON.parse(JSON.stringify(row));
      }
    );
  });
