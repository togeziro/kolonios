import type { QueryClient } from '@tanstack/react-query';
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { createIsomorphicFn } from '@tanstack/react-start';
import { Toaster } from '@/components/ui/sonner';
import { ActiveThemeProvider } from '@/components/themes/active-theme';
import ThemeProvider from '@/components/themes/theme-provider';
import { DEFAULT_THEME, THEMES } from '@/components/themes/theme.config';
import { I18nProvider } from '@/i18n/provider';

import '@/styles/globals.css';

const META_THEME_COLORS = {
  light: '#ffffff',
  dark: '#09090b'
};

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1];
}

const getActiveTheme = createIsomorphicFn()
  .server(async () => {
    const { getCookie } = await import('@tanstack/react-start/server');
    const cookieValue = getCookie('active_theme');
    if (cookieValue && THEMES.some((t) => t.value === cookieValue)) {
      return cookieValue;
    }
    return DEFAULT_THEME;
  })
  .client(async () => {
    const cookieValue = readCookie('active_theme');
    if (cookieValue && THEMES.some((t) => t.value === cookieValue)) {
      return cookieValue;
    }
    return DEFAULT_THEME;
  });

const getActiveLanguage = createIsomorphicFn()
  .server(async () => {
    const { getCookie, getRequestHeaders } = await import('@tanstack/react-start/server');
    const cookieValue = getCookie('i18next');
    if (cookieValue) {
      return cookieValue;
    }
    const headers = getRequestHeaders() as unknown as Record<string, string | undefined>;
    const acceptLanguage = headers['accept-language'];
    if (acceptLanguage) {
      const lang = acceptLanguage.split(',')[0]?.split('-')[0];
      if (lang === 'id') return 'id';
    }
    return 'en';
  })
  .client(async () => {
    const cookieValue = readCookie('i18next');
    if (cookieValue) {
      return cookieValue;
    }
    const lang = navigator.language?.split('-')[0];
    if (lang === 'id') return 'id';
    return 'en';
  });

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'kolonios' },
      {
        name: 'description',
        content: 'kolonios dashboard'
      },
      { tag: 'link', rel: 'icon', href: '/favicon.ico' }
    ]
  }),
  loader: async () => {
    const activeTheme = await getActiveTheme();
    const activeLanguage = await getActiveLanguage();
    return { activeTheme, activeLanguage };
  },
  component: RootDocument
});

function RootDocument() {
  const { activeTheme, activeLanguage } = Route.useLoaderData();

  return (
    <html lang={activeLanguage} suppressHydrationWarning data-theme={activeTheme}>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `
          }}
        />
      </head>
      <body className='bg-background overflow-x-hidden overscroll-none font-sans antialiased'>
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
          enableColorScheme
        >
          <ActiveThemeProvider initialTheme={activeTheme}>
            <I18nProvider initialLanguage={activeLanguage}>
              <Toaster />
              <Outlet />
            </I18nProvider>
          </ActiveThemeProvider>
        </ThemeProvider>
        {import.meta.env.DEV ? (
          <TanStackDevtools
            plugins={[
              { name: 'TanStack Query', render: <ReactQueryDevtoolsPanel /> },
              { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> }
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
