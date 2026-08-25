import { getAppLocale } from './locale/state';
import { id, enUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';

const DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const LONG_DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>();

function dateFormatter(locale: string): Intl.DateTimeFormat {
  let fmt = DATE_FORMATTERS.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    DATE_FORMATTERS.set(locale, fmt);
  }
  return fmt;
}

function longDateFormatter(locale: string): Intl.DateTimeFormat {
  let fmt = LONG_DATE_FORMATTERS.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    LONG_DATE_FORMATTERS.set(locale, fmt);
  }
  return fmt;
}

function currencyFormatter(locale: string): Intl.NumberFormat {
  let fmt = CURRENCY_FORMATTERS.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    CURRENCY_FORMATTERS.set(locale, fmt);
  }
  return fmt;
}

export function formatDate(
  value: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {},
  locale: string = getAppLocale()
): string {
  if (!value) return '';
  try {
    const formatter =
      opts && Object.keys(opts).length
        ? new Intl.DateTimeFormat(locale, opts)
        : dateFormatter(locale);
    return formatter.format(new Date(value));
  } catch {
    return '';
  }
}

export function formatLongDate(
  value: Date | string | number | undefined,
  locale: string = getAppLocale()
): string {
  if (!value) return '';
  try {
    return longDateFormatter(locale).format(new Date(value));
  } catch {
    return '';
  }
}

export function formatCurrency(value: number | string, locale: string = getAppLocale()): string {
  try {
    return currencyFormatter(locale).format(Number(value));
  } catch {
    return '';
  }
}

export function dateFnsLocale(locale: string = getAppLocale()): Locale {
  return locale === 'id-ID' ? id : enUS;
}

export function initialsFromName(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
