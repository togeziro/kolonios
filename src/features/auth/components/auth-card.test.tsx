// i18n:skip
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import AuthCard from './auth-card';

const { brandingMock } = vi.hoisted(() => ({
  brandingMock: vi.fn()
}));

vi.mock('@/features/branding/api/public-queries', () => ({
  usePublicBranding: brandingMock
}));

// Isolate the AuthCard-level logo gate from BrandLogo's own theme fallback.
vi.mock('@/features/branding/components/brand-logo', () => ({
  BrandLogo: () => <div data-testid='brand-logo' />
}));

vi.mock('@/components/language-switcher', () => ({
  LanguageSwitcher: () => <button data-testid='lang-switcher'>lang</button>
}));

vi.mock('@/components/themes/theme-mode-toggle', () => ({
  ThemeModeToggle: () => <button data-testid='theme-toggle'>theme</button>
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>
}));

function renderCard() {
  const queryClient = new QueryClient();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AuthCard
          title='Sign in title'
          subtitle='Sign in subtitle'
          linkLabel='Link label'
          linkTo='/auth/sign-up'
          linkText='Link text'
        >
          <div>Child content</div>
        </AuthCard>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

beforeEach(() => {
  brandingMock.mockReset();
});

describe('AuthCard footer copyright', () => {
  it('shows the company name from branding', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: null,
        logoDark: null,
        tagline: null,
        copyrightYear: null
      }
    });
    renderCard();
    expect(screen.getByText(`© ${new Date().getFullYear()}, Acme Corp.`)).toBeTruthy();
  });

  it('falls back to the product brand when branding is missing', () => {
    brandingMock.mockReturnValue({ data: undefined });
    renderCard();
    expect(screen.getByText(`© ${new Date().getFullYear()}, TanStack Dashboard.`)).toBeTruthy();
  });
});

describe('AuthCard logo gate', () => {
  it('renders the logo when only the dark slot is set', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: null,
        logoDark: 'data:dark',
        tagline: null,
        copyrightYear: null
      }
    });
    renderCard();
    expect(screen.getByTestId('brand-logo')).toBeTruthy();
  });

  it('renders the logo when only the light slot is set', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: 'data:light',
        logoDark: null,
        tagline: null,
        copyrightYear: null
      }
    });
    renderCard();
    expect(screen.getByTestId('brand-logo')).toBeTruthy();
  });

  it('renders no logo when both slots are empty', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: null,
        logoDark: null,
        tagline: null,
        copyrightYear: null
      }
    });
    renderCard();
    expect(screen.queryByTestId('brand-logo')).toBeNull();
  });
});

describe('AuthCard header layout', () => {
  it('stacks the logo above the company name (vertical, not side-by-side)', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: 'data:light',
        logoDark: null,
        tagline: null,
        copyrightYear: null
      }
    });
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={new QueryClient()}>
          <AuthCard
            title='Sign in title'
            subtitle='Sign in subtitle'
            linkLabel='Link label'
            linkTo='/auth/sign-up'
            linkText='Link text'
          >
            <div>Child content</div>
          </AuthCard>
        </QueryClientProvider>
      </I18nextProvider>
    );
    const logo = screen.getByTestId('brand-logo');
    const name = screen.getByText('Acme Corp');
    // The logo and name share the same flex column parent, with logo as the
    // first child (above) and name below — column layout, not row.
    const parent = logo.parentElement;
    expect(parent).not.toBeNull();
    expect(parent).toBe(name.parentElement);
    expect(parent?.className).toContain('flex-col');
    expect(parent?.className).toContain('items-center');
    // DOM order: logo first (above), name second (below).
    expect(Array.from(parent!.children).indexOf(logo)).toBeLessThan(
      Array.from(parent!.children).indexOf(name)
    );
    expect(container).toBeTruthy();
  });
});

describe('AuthCard footer controls', () => {
  it('always renders the language switcher and theme toggle in the footer', () => {
    brandingMock.mockReturnValue({ data: undefined });
    renderCard();
    expect(screen.getByTestId('lang-switcher')).toBeTruthy();
    expect(screen.getByTestId('theme-toggle')).toBeTruthy();
  });

  it('uses branding.copyrightYear when set, otherwise current year', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: null,
        logoDark: null,
        tagline: null,
        copyrightYear: 2024
      }
    });
    renderCard();
    expect(screen.getByText(`© 2024, Acme Corp.`)).toBeTruthy();
  });
});
