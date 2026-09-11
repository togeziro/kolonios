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
          linkTo='/auth/v2/sign-up'
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
    brandingMock.mockReturnValue({ data: { name: 'Acme Corp', logoLight: null, logoDark: null } });
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
      data: { name: 'Acme Corp', logoLight: null, logoDark: 'data:dark' }
    });
    renderCard();
    expect(screen.getByTestId('brand-logo')).toBeTruthy();
  });

  it('renders the logo when only the light slot is set', () => {
    brandingMock.mockReturnValue({
      data: { name: 'Acme Corp', logoLight: 'data:light', logoDark: null }
    });
    renderCard();
    expect(screen.getByTestId('brand-logo')).toBeTruthy();
  });

  it('renders no logo when both slots are empty', () => {
    brandingMock.mockReturnValue({ data: { name: 'Acme Corp', logoLight: null, logoDark: null } });
    renderCard();
    expect(screen.queryByTestId('brand-logo')).toBeNull();
  });
});
