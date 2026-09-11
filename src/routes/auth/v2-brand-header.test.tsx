// i18n:skip
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { V2BrandHeader } from './v2';

const { brandingMock } = vi.hoisted(() => ({
  brandingMock: vi.fn()
}));

vi.mock('@/features/branding/api/public-queries', () => ({
  usePublicBranding: brandingMock
}));

vi.mock('@/features/branding/components/brand-logo', () => ({
  BrandLogo: () => <div data-testid='panel-logo' />,
  BrandName: ({ fallback }: { fallback: string }) => <>{brandingMock().data?.name ?? fallback}</>
}));

function renderHeader() {
  const queryClient = new QueryClient();
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <V2BrandHeader />
      </QueryClientProvider>
    </I18nextProvider>
  );
}

beforeEach(() => {
  brandingMock.mockReset();
});

describe('V2BrandHeader', () => {
  it('shows the company name and logo from branding', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: 'data:l',
        logoDark: null,
        tagline: null,
        copyrightYear: null
      }
    });
    renderHeader();
    expect(screen.getByText('Acme Corp')).toBeTruthy();
    expect(screen.getByTestId('panel-logo')).toBeTruthy();
  });

  it('falls back to the product brand when branding is missing', () => {
    brandingMock.mockReturnValue({ data: undefined });
    renderHeader();
    expect(screen.getByText('TanStack Dashboard')).toBeTruthy();
  });

  it('does not render an h1 so the card title stays the only one', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: null,
        logoDark: null,
        tagline: null,
        copyrightYear: null
      }
    });
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={new QueryClient()}>
          <V2BrandHeader />
        </QueryClientProvider>
      </I18nextProvider>
    );
    expect(container.querySelector('h1')).toBeNull();
  });

  it('renders the tagline when branding.tagline is set', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: null,
        logoDark: null,
        tagline: 'Design. Build. Ship.',
        copyrightYear: null
      }
    });
    renderHeader();
    expect(screen.getByText('Design. Build. Ship.')).toBeTruthy();
  });

  it('hides the tagline when branding.tagline is null', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: null,
        logoDark: null,
        tagline: null,
        copyrightYear: null
      }
    });
    const { container } = renderHeader();
    expect(container.querySelectorAll('p').length).toBe(1);
  });

  it('hides the tagline when branding.tagline is empty or whitespace', () => {
    brandingMock.mockReturnValue({
      data: {
        name: 'Acme Corp',
        logoLight: null,
        logoDark: null,
        tagline: '   ',
        copyrightYear: null
      }
    });
    const { container } = renderHeader();
    expect(container.querySelectorAll('p').length).toBe(1);
  });
});
