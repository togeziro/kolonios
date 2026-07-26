import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en/translation.json';
import idTranslation from './locales/id/translation.json';

export const defaultLanguage = 'en';
export const supportedLanguages = ['en', 'id'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const resources = {
  en: {
    translation: enTranslation
  },
  id: {
    translation: idTranslation
  }
} as const;

export function createI18nInstance(initialLanguage?: string) {
  const instance = createInstance();

  instance.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages,
    interpolation: {
      escapeValue: false
    },
    detection: {
      caches: ['localStorage'],
      lookupCookie: 'i18next',
      cookieMinutes: 365 * 24 * 60
    },
    react: {
      useSuspense: false
    }
  });

  return instance;
}

export default createI18nInstance();
