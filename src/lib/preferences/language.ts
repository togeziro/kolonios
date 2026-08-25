import type { i18n as I18nInstance } from 'i18next';
import type { SupportedLanguage } from '@/i18n/config';

// Module scope so the document/global mutations never appear to happen
// during render — this only ever runs from click handlers.
export function applyLanguage(i18n: Pick<I18nInstance, 'changeLanguage'>, lng: SupportedLanguage) {
  void i18n.changeLanguage(lng);
  document.cookie = `i18next=${lng}; path=/; max-age=31536000; SameSite=Lax; ${
    window.location.protocol === 'https:' ? 'Secure;' : ''
  }`;
  document.documentElement.lang = lng;
}
