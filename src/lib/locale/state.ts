import { DEFAULT_LOCALE, type AppLocale } from './types';

let currentLocale: AppLocale = DEFAULT_LOCALE;

export function getAppLocale(): AppLocale {
  return currentLocale;
}

export function setAppLocale(locale: AppLocale): void {
  currentLocale = locale;
}
