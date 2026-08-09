export type AppLocale = 'id-ID' | 'en-US';
export const DEFAULT_LOCALE: AppLocale = 'id-ID';
export const APP_LOCALES: readonly AppLocale[] = ['id-ID', 'en-US'];

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}
