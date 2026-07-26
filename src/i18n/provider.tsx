import { type PropsWithChildren, useEffect, useState } from 'react';
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

interface I18nProviderProps {
  initialLanguage?: string;
}

export function I18nProvider({ children, initialLanguage }: PropsWithChildren<I18nProviderProps>) {
  const [instance, setInstance] = useState<I18nInstance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !instance) {
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
      setInstance(newInstance);
    }
  }, [instance, initialLanguage]);

  if (!instance) {
    return <>{children}</>;
  }

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
