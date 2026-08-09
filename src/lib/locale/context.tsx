import * as React from 'react';
import { DEFAULT_LOCALE, type AppLocale } from './types';
import { setAppLocale } from './state';
import { useAppLocale as useAppLocaleQuery } from '@/features/settings/api';

const LocaleContext = React.createContext<AppLocale>(DEFAULT_LOCALE);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const serverLocale = useAppLocaleQuery();

  React.useEffect(() => {
    setAppLocale(serverLocale);
  }, [serverLocale]);

  return <LocaleContext.Provider value={serverLocale}>{children}</LocaleContext.Provider>;
}

export function useAppLocale(): AppLocale {
  return React.useContext(LocaleContext);
}
