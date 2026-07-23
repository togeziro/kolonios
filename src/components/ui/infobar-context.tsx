import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useLocation } from '@tanstack/react-router';
import * as React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

const INFOBAR_WIDTH = '22rem';
const INFOBAR_WIDTH_ICON = '3rem';
const INFOBAR_KEYBOARD_SHORTCUT = 'i';

export type HelpfulLink = {
  title: string;
  url: string;
};

export type DescriptiveSection = {
  title: string;
  description: string;
  links?: HelpfulLink[];
};

export type InfobarContent = {
  title: string;
  sections: DescriptiveSection[];
};

type InfobarContextProps = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleInfobar: () => void;
  content: InfobarContent | null;
  setContent: (content: InfobarContent | null) => void;
  isPathnameChanging: boolean;
};

const InfobarContext = React.createContext<InfobarContextProps | null>(null);

function useInfobar() {
  const context = React.useContext(InfobarContext);
  if (!context) {
    throw new Error('useInfobar must be used within a InfobarProvider.');
  }

  return context;
}

function InfobarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [content, setContent] = React.useState<InfobarContent | null>(null);
  const [contentPathname, setContentPathname] = React.useState<string | null>(null);
  const [isPathnameChanging, setIsPathnameChanging] = React.useState(false);
  const { pathname } = useLocation();

  // This is the internal state of the infobar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value;

      // On mobile, also update the mobile state for the Sheet component
      if (isMobile) {
        setOpenMobile(openState);
      }

      // Handle desktop state
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }
    },
    [setOpenProp, open, isMobile]
  );

  // Helper to toggle the infobar.
  const toggleInfobar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen, setOpenMobile]);

  // Close infobar when switching between mobile and desktop to prevent state desync
  React.useEffect(() => {
    setOpenMobile(false);
    _setOpen(false);
  }, [isMobile]);

  // Adds a keyboard shortcut to toggle the infobar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === INFOBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleInfobar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleInfobar]);

  // Clear content and close infobar when pathname changes
  React.useEffect(() => {
    if (contentPathname !== null && contentPathname !== pathname) {
      setIsPathnameChanging(true);
      setContent(null);
      setContentPathname(null);
      setOpen(false);

      const timer = setTimeout(() => {
        setIsPathnameChanging(false);
      }, 200);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setOpen is a stable React state setter
  }, [pathname, contentPathname]);

  // Update setContent to also track pathname
  const handleSetContent = React.useCallback(
    (newContent: InfobarContent | null) => {
      setContent(newContent);
      setContentPathname(newContent ? pathname : null);
    },
    [pathname]
  );

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the infobar with Tailwind classes.
  const state = open ? 'expanded' : 'collapsed';

  // Update context to use handleSetContent instead of setContent
  const contextValue = React.useMemo<InfobarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleInfobar,
      content,
      setContent: handleSetContent,
      isPathnameChanging
    }),
    [
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleInfobar,
      content,
      handleSetContent,
      isPathnameChanging
    ]
  );

  return (
    <InfobarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot='infobar-wrapper'
          style={
            {
              '--infobar-width': INFOBAR_WIDTH,
              '--infobar-width-icon': INFOBAR_WIDTH_ICON,
              ...style
            } as React.CSSProperties
          }
          className={cn('group/infobar-wrapper flex flex-1 w-full', className)}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </InfobarContext.Provider>
  );
}

export { InfobarContext, InfobarProvider, useInfobar };
