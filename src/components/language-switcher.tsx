import { useTranslation } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';
import { supportedLanguages, type SupportedLanguage } from '@/i18n/config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

const languageLabels: Record<SupportedLanguage, string> = {
  en: 'English',
  id: 'Indonesia'
};

const languageCodes: Record<SupportedLanguage, string> = {
  en: 'EN',
  id: 'ID'
};

// Module scope so the document/global mutations never appear to happen
// during render — this only ever runs from the menu item click handler.
function changeLanguage(i18n: Pick<I18nInstance, 'changeLanguage'>, lng: SupportedLanguage) {
  void i18n.changeLanguage(lng);
  document.cookie = `i18next=${lng}; path=/; max-age=31536000; SameSite=Lax; ${
    window.location.protocol === 'https:' ? 'Secure;' : ''
  }`;
  document.documentElement.lang = lng;
}

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language as SupportedLanguage;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='h-8 w-8'>
          <Icons.globe className='h-4 w-4' />
          <span className='sr-only'>{languageLabels[currentLanguage] || currentLanguage}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[120px]'>
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => changeLanguage(i18n, lang)}
            className={cn(currentLanguage === lang && 'bg-accent font-medium')}
          >
            <span className='font-mono text-xs'>{languageCodes[lang]}</span>
            <span className='ml-2'>{languageLabels[lang]}</span>
            {currentLanguage === lang && <Icons.check className='ml-auto h-4 w-4' />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
