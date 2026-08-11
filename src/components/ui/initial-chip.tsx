import { cn } from '@/lib/utils';
import { getColorForName, getInitials } from '@/lib/avatar-color';

interface InitialChipProps {
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function InitialChip({ name, size = 'md', className }: InitialChipProps) {
  const color = getColorForName(name);
  const initials = getInitials(name);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-medium',
        color.bg,
        color.fg,
        color.darkBg,
        color.darkFg,
        size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm',
        className
      )}
      title={name}
    >
      {initials}
    </div>
  );
}
