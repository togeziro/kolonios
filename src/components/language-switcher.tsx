import { useTranslation } from 'react-i18next';
import { supportedLanguages, type SupportedLanguage } from '@/i18n/config';
import { applyLanguage } from '@/lib/preferences/language';
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
            onClick={() => applyLanguage(i18n, lang)}
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
