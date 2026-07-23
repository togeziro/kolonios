import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { useInfobar } from './infobar-context';

function InfobarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleInfobar } = useInfobar();

  return (
    <Button
      data-infobar='trigger'
      data-slot='infobar-trigger'
      variant='ghost'
      size='icon'
      className={cn('size-7', className)}
      aria-label='Close info panel'
      onClick={(event) => {
        onClick?.(event);
        toggleInfobar();
      }}
      {...props}
    >
      <Icons.chevronsRight className='size-4' />
    </Button>
  );
}

export { InfobarTrigger };
