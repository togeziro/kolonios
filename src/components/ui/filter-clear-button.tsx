import type * as React from 'react';

import { Icons } from '@/components/icons';

interface FilterClearButtonProps {
  title?: string;
  onReset: (event: React.MouseEvent) => void;
}

export function FilterClearButton({ title, onReset }: FilterClearButtonProps) {
  return (
    <button
      type='button'
      aria-label={`Clear ${title} filter`}
      className='focus-visible:ring-ring rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:outline-none'
      onClick={onReset}
    >
      <Icons.xCircle />
    </button>
  );
}
