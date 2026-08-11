import { ReactNode, createContext, useContext, useEffect, useState } from 'react';

import {
  DEFAULT_THEME_PRESET,
  THEME_PRESET_VALUES,
  type ThemePreset
} from '@/lib/preferences/theme';
import { loadFontsForTheme } from '@/lib/fonts';

const COOKIE_NAME = 'theme_preset';

function setThemePresetCookie(theme: string) {
  if (typeof window === 'undefined') return;

  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
}

type ThemeContextType = {
  activePreset: ThemePreset;
  setActivePreset: (theme: ThemePreset) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
  children,
  initialPreset
}: {
  children: ReactNode;
  initialPreset?: string;
}) {
  const presetToUse = THEME_PRESET_VALUES.includes(initialPreset as ThemePreset)
    ? (initialPreset as ThemePreset)
    : DEFAULT_THEME_PRESET;
  const [activePreset, setActivePreset] = useState<ThemePreset>(presetToUse);

  useEffect(() => {
    // Only update if theme has changed
    const currentPreset = document.documentElement.getAttribute('data-theme-preset');
    if (currentPreset !== activePreset) {
      setThemePresetCookie(activePreset);

      // Set data-theme-preset on html element
      document.documentElement.setAttribute('data-theme-preset', activePreset);
    } else {
      // Still update cookie in case it's missing
      setThemePresetCookie(activePreset);
    }
  }, [activePreset]);

  useEffect(() => {
    loadFontsForTheme(activePreset);
  }, [activePreset]);

  return (
    <ThemeContext.Provider value={{ activePreset, setActivePreset }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeConfig must be used within an ActiveThemeProvider');
  }
  return context;
}
