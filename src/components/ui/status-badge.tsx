import { cn } from '@/lib/utils';

type StatusConfig = {
  bg: string;
  fg: string;
  dot: string;
  darkBg: string;
  darkFg: string;
  darkDot: string;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  active: {
    bg: 'bg-emerald-50',
    fg: 'text-emerald-700',
    dot: 'bg-emerald-500',
    darkBg: 'dark:bg-emerald-500/15',
    darkFg: 'dark:text-emerald-400',
    darkDot: 'dark:bg-emerald-400'
  },
  inactive: {
    bg: 'bg-gray-50',
    fg: 'text-gray-600',
    dot: 'bg-gray-400',
    darkBg: 'dark:bg-gray-500/15',
    darkFg: 'dark:text-gray-400',
    darkDot: 'dark:bg-gray-400'
  },
  pending: {
    bg: 'bg-amber-50',
    fg: 'text-amber-700',
    dot: 'bg-amber-500',
    darkBg: 'dark:bg-amber-500/15',
    darkFg: 'dark:text-amber-400',
    darkDot: 'dark:bg-amber-400'
  },
  suspended: {
    bg: 'bg-rose-50',
    fg: 'text-rose-700',
    dot: 'bg-rose-500',
    darkBg: 'dark:bg-rose-500/15',
    darkFg: 'dark:text-rose-400',
    darkDot: 'dark:bg-rose-400'
  },
  cancelled: {
    bg: 'bg-rose-50',
    fg: 'text-rose-700',
    dot: 'bg-rose-500',
    darkBg: 'dark:bg-rose-500/15',
    darkFg: 'dark:text-rose-400',
    darkDot: 'dark:bg-rose-400'
  }
};

const FALLBACK: StatusConfig = {
  bg: 'bg-gray-50',
  fg: 'text-gray-600',
  dot: 'bg-gray-400',
  darkBg: 'dark:bg-gray-500/15',
  darkFg: 'dark:text-gray-400',
  darkDot: 'dark:bg-gray-400'
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const key = status?.toLowerCase() ?? '';
  const config = STATUS_MAP[key] ?? FALLBACK;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.bg,
        config.fg,
        config.darkBg,
        config.darkFg,
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', config.dot, config.darkDot)} />
      {label ?? status}
    </span>
  );
}
