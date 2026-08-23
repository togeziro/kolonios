import * as React from 'react';
import { DEFAULT_LOCALE, type AppLocale } from './types';

export const LocaleContext = React.createContext<AppLocale>(DEFAULT_LOCALE);

export function useAppLocale(): AppLocale {
  return React.useContext(LocaleContext);
}
