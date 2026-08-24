import { type PropsWithChildren, useState } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createInstance, type i18n as I18nInstance } from 'i18next';

import { resources, supportedLanguages, defaultLanguage } from './config';

export { supportedLanguages, defaultLanguage };
export type { SupportedLanguage } from './config';

export async function getServerSideI18n(initialLanguage?: string): Promise<I18nInstance> {
  const instance = createInstance();
  instance.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages,
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });
  return instance;
}

// Browser-only instance creation; touches cookies/localStorage via the
// language-detector plugin, so it must never run during the server render.
function createClientI18n(initialLanguage?: string): I18nInstance {
  const newInstance = createInstance();
  newInstance.use(initReactI18next).init({
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
  return newInstance;
}

interface I18nProviderProps {
  initialLanguage?: string;
}

export function I18nProvider({ children, initialLanguage }: PropsWithChildren<I18nProviderProps>) {
  // Initialize the client instance directly (once per mount) instead of
  // creating it in an effect; on the server there is no `window`, so children
  // render bare exactly as before.
  const [instance] = useState<I18nInstance | null>(() =>
    typeof window === 'undefined' ? null : createClientI18n(initialLanguage)
  );

  if (!instance) {
    return <>{children}</>;
  }

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
