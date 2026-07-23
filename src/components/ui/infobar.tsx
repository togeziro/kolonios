import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { useInfobar, type InfobarContent as InfobarContentType } from './infobar-context';

const INFOBAR_WIDTH_MOBILE = '22rem';

function Infobar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
}) {
  const { isMobile, state, setOpen, openMobile, setOpenMobile, isPathnameChanging } = useInfobar();

  if (collapsible === 'none') {
    return (
      <div
        data-slot='infobar'
        className={cn(
          'bg-sidebar text-sidebar-foreground flex h-full w-(--infobar-width) flex-col',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet
        open={openMobile}
        onOpenChange={(value) => {
          setOpenMobile(value);
          setOpen(value);
        }}
        {...props}
      >
        <SheetContent
          data-infobar='infobar'
          data-slot='infobar'
          data-mobile='true'
          className='bg-sidebar text-sidebar-foreground w-(--infobar-width) p-0 [&>button]:hidden'
          style={
            {
              '--infobar-width': INFOBAR_WIDTH_MOBILE
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className='sr-only'>
            <SheetTitle>Infobar</SheetTitle>
            <SheetDescription>Displays the mobile infobar.</SheetDescription>
          </SheetHeader>
          <div className='flex h-full w-full flex-col'>{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className='group peer text-sidebar-foreground hidden md:block'
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      data-slot='infobar'
      style={
        {
          '--infobar-transition-duration': isPathnameChanging ? '0ms' : '300ms'
        } as React.CSSProperties
      }
    >
      <div
        data-slot='infobar-container'
        className={cn(
          'sticky top-0 z-30 hidden h-[calc(100dvh-4.5rem)] w-(--infobar-width) shrink-0 p-2 pl-0 transition-[width,padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:flex',
          'group-data-[collapsible=offcanvas]:w-0 group-data-[collapsible=offcanvas]:overflow-hidden group-data-[collapsible=offcanvas]:p-0',
          className
        )}
        {...props}
      >
        <div
          data-infobar='infobar'
          data-slot='infobar-inner'
          className='bg-sidebar text-sidebar-foreground flex h-full w-full flex-col overflow-y-auto rounded-lg border border-sidebar-border transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[collapsible=offcanvas]:scale-95 group-data-[collapsible=offcanvas]:opacity-0'
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function InfobarRail({ className, ...props }: React.ComponentProps<'button'>) {
  const { toggleInfobar } = useInfobar();

  return (
    <button
      data-infobar='rail'
      data-slot='infobar-rail'
      aria-label='Toggle Infobar'
      tabIndex={-1}
      onClick={toggleInfobar}
      title='Toggle Infobar'
      className={cn(
        'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex',
        'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className
      )}
      {...props}
    />
  );
}

function InfobarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot='infobar-inset'
      className={cn(
        'bg-background relative flex w-full flex-1 flex-col',
        'md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className
      )}
      {...props}
    />
  );
}

function InfobarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot='infobar-input'
      data-infobar='input'
      className={cn('bg-background h-8 w-full shadow-none', className)}
      {...props}
    />
  );
}

function InfobarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='infobar-header'
      data-infobar='header'
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function InfobarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='infobar-footer'
      data-infobar='footer'
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function InfobarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot='infobar-separator'
      data-infobar='separator'
      className={cn('bg-sidebar-border mx-2 w-auto', className)}
      {...props}
    />
  );
}

function InfobarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='infobar-content'
      data-infobar='content'
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className
      )}
      {...props}
    />
  );
}

type InfobarContent = InfobarContentType;

export {
  Infobar,
  InfobarContent,
  InfobarFooter,
  InfobarHeader,
  InfobarInput,
  InfobarInset,
  InfobarRail,
  InfobarSeparator
};

export { InfobarTrigger } from './infobar-sheet';
export {
  InfobarProvider,
  useInfobar,
  type HelpfulLink,
  type DescriptiveSection
} from './infobar-context';
export {
  InfobarMenu,
  InfobarMenuAction,
  InfobarMenuBadge,
  InfobarMenuButton,
  InfobarMenuItem,
  InfobarMenuSkeleton,
  InfobarMenuSub,
  InfobarMenuSubButton,
  InfobarMenuSubItem
} from './infobar-menu';
export {
  InfobarGroup,
  InfobarGroupAction,
  InfobarGroupContent,
  InfobarGroupLabel
} from './infobar-group';
