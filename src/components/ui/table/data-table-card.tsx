import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className={cn('flex min-h-0 flex-1 flex-col gap-0 overflow-hidden', className)}>
      {(title || description || action) && (
        <CardHeader className='border-b px-4 py-4 md:px-6'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='min-w-0'>
              {title && <CardTitle className='text-xl leading-none'>{title}</CardTitle>}
              {description && (
                <CardDescription className='mt-1 max-w-sm leading-snug'>
                  {description}
                </CardDescription>
              )}
            </div>
            {action && <div className='flex shrink-0 flex-wrap items-center gap-2'>{action}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent className='flex min-h-0 flex-1 flex-col px-0 py-0'>{children}</CardContent>
    </Card>
  );
}
