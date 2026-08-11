import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted hover:text-foreground dark:hover:bg-muted/50',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-8 gap-1.5 px-2.5 has-[>svg]:pl-2',
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5 has-[>svg]:pl-1.5",
        lg: 'h-9 gap-1.5 px-2.5 has-[>svg]:pl-2',
        icon: 'size-8'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading,
  children,
  disabled,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    isLoading?: boolean;
  }) {
  if (asChild) {
    return (
      <Slot
        data-slot='button'
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  // Normal button — no loading support, default shadcn behavior
  if (isLoading === undefined) {
    return (
      <button
        data-slot='button'
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }

  // Loading-aware button — grid overlap for zero layout shift.
  // Children are always wrapped in a span so has-[>svg] padding
  // stays consistent between loading and non-loading states.
  return (
    <button
      data-slot='button'
      className={cn(
        buttonVariants({ variant, size }),
        'grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1',
        className
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      <span className={cn('inline-flex items-center gap-2', isLoading && 'invisible')}>
        {children}
      </span>
      <span className={cn('flex items-center justify-center', !isLoading && 'invisible')}>
        <Spinner />
      </span>
    </button>
  );
}

export { Button, buttonVariants };
