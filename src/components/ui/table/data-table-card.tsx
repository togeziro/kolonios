import * as React from 'react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DataTableCardProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function DataTableCard({
  title,
  description,
  action,
  className,
  children
}: DataTableCardProps) {
  return (
    <Card className={cn('flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0', className)}>
      {(title || description || action) && (
        <CardHeader className='border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]'>
          <div className='min-w-0'>
            {title && <CardTitle className='text-xl leading-none'>{title}</CardTitle>}
            {description && (
              <CardDescription className='max-w-sm leading-snug'>{description}</CardDescription>
            )}
          </div>
          {action && (
            <CardAction className='col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end'>
              {action}
            </CardAction>
          )}
        </CardHeader>
      )}
      <CardContent className='flex min-h-0 flex-1 flex-col px-0 py-0'>{children}</CardContent>
    </Card>
  );
}
