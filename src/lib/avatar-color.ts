const PALETTE = [
  {
    bg: 'bg-indigo-100',
    fg: 'text-indigo-700',
    darkBg: 'dark:bg-indigo-500/20',
    darkFg: 'dark:text-indigo-300'
  },
  {
    bg: 'bg-emerald-100',
    fg: 'text-emerald-700',
    darkBg: 'dark:bg-emerald-500/20',
    darkFg: 'dark:text-emerald-300'
  },
  {
    bg: 'bg-amber-100',
    fg: 'text-amber-700',
    darkBg: 'dark:bg-amber-500/20',
    darkFg: 'dark:text-amber-300'
  },
  {
    bg: 'bg-rose-100',
    fg: 'text-rose-700',
    darkBg: 'dark:bg-rose-500/20',
    darkFg: 'dark:text-rose-300'
  },
  {
    bg: 'bg-sky-100',
    fg: 'text-sky-700',
    darkBg: 'dark:bg-sky-500/20',
    darkFg: 'dark:text-sky-300'
  },
  {
    bg: 'bg-violet-100',
    fg: 'text-violet-700',
    darkBg: 'dark:bg-violet-500/20',
    darkFg: 'dark:text-violet-300'
  },
  {
    bg: 'bg-teal-100',
    fg: 'text-teal-700',
    darkBg: 'dark:bg-teal-500/20',
    darkFg: 'dark:text-teal-300'
  },
  {
    bg: 'bg-orange-100',
    fg: 'text-orange-700',
    darkBg: 'dark:bg-orange-500/20',
    darkFg: 'dark:text-orange-300'
  }
] as const;

export type PaletteEntry = (typeof PALETTE)[number];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getColorForName(name: string): PaletteEntry {
  const index = hashString(name) % PALETTE.length;
  return PALETTE[index];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
