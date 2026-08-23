import * as React from 'react';
import { setAppLocale } from '@/lib/locale/state';
import { LocaleContext } from '@/lib/locale/context';
import type { AppLocale } from '@/lib/locale/types';
import { useAppLocale as useAppLocaleQuery } from './api';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const serverLocale = useAppLocaleQuery();

  React.useEffect(() => {
    setAppLocale(serverLocale);
  }, [serverLocale]);

  return <LocaleContext.Provider value={serverLocale}>{children}</LocaleContext.Provider>;
}
