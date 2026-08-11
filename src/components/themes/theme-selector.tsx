import { useThemeConfig } from '@/components/themes/active-theme';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import { Icons } from '../icons';
import { Kbd } from '@/components/ui/kbd';
import { THEME_PRESET_OPTIONS } from '@/lib/preferences/theme';
import { useTheme } from 'next-themes';

export function ThemeSelector() {
  const { activePreset, setActivePreset } = useThemeConfig();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className='flex items-center gap-2'>
      <Label htmlFor='theme-selector' className='sr-only'>
        Theme
      </Label>
      <Select value={activePreset} onValueChange={(v) => setActivePreset(v as typeof activePreset)}>
        <SelectTrigger
          id='theme-selector'
          className='justify-start *:data-[slot=select-value]:w-24'
        >
          <span className='text-muted-foreground hidden sm:block'>
            <Icons.palette />
          </span>
          <span className='text-muted-foreground block sm:hidden'>Theme</span>
          <SelectValue placeholder='Select a theme' />
          <Kbd>T T</Kbd>
        </SelectTrigger>
        <SelectContent align='end'>
          {THEME_PRESET_OPTIONS.length > 0 && (
            <>
              <SelectGroup>
                <SelectLabel>themes</SelectLabel>
                {THEME_PRESET_OPTIONS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    <span className='flex items-center gap-2'>
                      <span
                        className='size-2.5 rounded-full'
                        style={{
                          backgroundColor: isDark ? preset.primary.dark : preset.primary.light
                        }}
                      />
                      {preset.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
