import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Vertical timeline primitive: a continuous line on the left with a dot
 * per child, and a content column on the right. Children get a `dot` +
 * a `connector` slot provided as a render prop so a single line flows
 * between every item without per-card layout decisions.
 *
 * The first item drops its top connector (no line above), and the last
 * item drops its bottom connector (no line below the final dot). This
 * keeps the line flush at the top and bottom of the column.
 */
export function CareerTimeline({ children }: { children: ReactNode[] | ReactNode }) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <ol className='relative flex flex-col gap-4 pl-12' data-testid='career-timeline'>
      <span
        className='bg-border absolute top-2 bottom-2 left-3 w-px'
        aria-hidden='true'
        data-testid='career-timeline-line'
      />
      {items.map((child, index) => {
        const isFirst = index === 0;
        const isLast = index === items.length - 1;
        return (
          <li
            key={index}
            className='relative'
            data-testid='career-timeline-item-shell'
            data-first={isFirst ? 'true' : undefined}
            data-last={isLast ? 'true' : undefined}
          >
            <span
              className={cn(
                'bg-background border-border absolute top-2 left-[-2.55rem] z-10 flex h-3 w-3 items-center justify-center rounded-full border-2',
                !isFirst &&
                  'before:bg-border before:absolute before:-top-6 before:left-1/2 before:h-6 before:w-px before:-translate-x-1/2',
                !isLast &&
                  'after:bg-border after:absolute after:-bottom-6 after:left-1/2 after:h-6 after:w-px after:-translate-x-1/2'
              )}
              aria-hidden='true'
              data-testid='career-timeline-dot'
            />
            {child}
          </li>
        );
      })}
    </ol>
  );
}
