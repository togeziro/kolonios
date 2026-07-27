import type * as React from 'react';

import { Icons } from '@/components/icons';

interface FilterClearButtonProps {
  title?: string;
  onReset: (event: React.MouseEvent) => void;
}

export function FilterClearButton({ title, onReset }: FilterClearButtonProps) {
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onReset(e as unknown as React.MouseEvent);
    }
  };
  return (
    <span
      role='button'
      tabIndex={0}
      aria-label={`Clear ${title} filter`}
      className='focus-visible:ring-ring rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:outline-none'
      onClick={onReset}
      onKeyDown={onKeyDown}
    >
      <Icons.xCircle />
    </span>
  );
}
