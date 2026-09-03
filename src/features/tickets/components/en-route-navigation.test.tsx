// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { detailMock, navigateMock, arriveMock, currentLocationMock } = vi.hoisted(() => ({
  detailMock: vi.fn(),
  navigateMock: vi.fn(),
  arriveMock: vi.fn(),
  currentLocationMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: () => ({ data: detailMock(), isLoading: false }) };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock
}));

vi.mock('../api/hooks', () => ({
  useArriveTicket: () => ({ mutate: arriveMock, isPending: false })
}));

vi.mock('@/features/attendance/utils/geolocation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/attendance/utils/geolocation')>();
  return { ...actual, getCurrentLocation: currentLocationMock };
});

// MapLibre is browser/WebGL-only; the page must render without it.
vi.mock('@/components/ui/route-map', () => ({
  EnRouteMap: () => <div data-testid='en-route-map-stub' />
}));

import EnRouteNavigationPage from './en-route-navigation';

const CUSTOMER = {
  id: 'c1',
  name: 'PT Nusantara',
  latitude: -6.2,
  longitude: 106.8,
  address: 'Jl. Jend. Sudirman 1',
  phone: '+6281234567890'
};

const BASE_TICKET = {
  id: 9,
  ticketCode: 'T-9',
  title: 'Field install',
  status: 'assigned',
  priority: 'high',
  customer: CUSTOMER,
  location: { id: 1, name: 'Head Office' }
};

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <EnRouteNavigationPage ticketId={9} />
    </I18nextProvider>
  );
}

const FIX = {
  latitude: -6.2001,
  longitude: 106.8001,
  accuracy: 12,
  capturedAt: Date.now()
};

describe('EnRouteNavigationPage', () => {
  beforeEach(() => {
    detailMock.mockReturnValue({ success: true, ticket: { ...BASE_TICKET } });
    currentLocationMock.mockResolvedValue({ status: 'success', location: FIX });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the ticket card, contact actions, map, and arrival bar for an assigned ticket', () => {
    renderPage();

    expect(screen.getByText('Field install')).toBeTruthy();
    expect(screen.getByText('T-9')).toBeTruthy();
    expect(screen.getByRole('link', { name: /\+6281234567890|call/i })).toBeTruthy();
    expect(screen.getByTestId('en-route-map-stub')).toBeTruthy();
    expect(screen.getByRole('button', { name: /arrived/i })).toBeTruthy();
  });

  it('sends the captured GPS fix when arrival succeeds', async () => {
    arriveMock.mockImplementation((_input, opts) => opts?.onSuccess?.({ success: true }));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /arrived/i }));

    await waitFor(() =>
      expect(arriveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: 9,
          latitude: FIX.latitude,
          longitude: FIX.longitude,
          accuracy: FIX.accuracy
        }),
        expect.anything()
      )
    );
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/dashboard/work-session/$ticketId',
        params: { ticketId: '9' }
      })
    );
  });

  it('opens the no-location dialog when GPS fails and still records the arrival without coordinates', async () => {
    currentLocationMock.mockResolvedValue({ status: 'permission-denied' });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /arrived/i }));

    // The confirm dialog explains the arrival will be recorded without coords.
    expect(await screen.findByRole('heading', { name: /arrive without location/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^arrive without location$/i }));
    await waitFor(() =>
      expect(arriveMock).toHaveBeenCalledWith(
        expect.objectContaining({ ticketId: 9 }),
        expect.anything()
      )
    );
    expect(arriveMock.mock.calls[0][0]).not.toHaveProperty('latitude');
  });

  it('does not record an arrival when the no-location dialog is cancelled', async () => {
    currentLocationMock.mockResolvedValue({ status: 'permission-denied' });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /arrived/i }));
    expect(await screen.findByRole('heading', { name: /arrive without location/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(arriveMock).not.toHaveBeenCalled();
  });

  it('ignores a second I-have-arrived click while the first arrival flow is running', async () => {
    let resolveLocation: (value: unknown) => void = () => {};
    currentLocationMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLocation = resolve;
      })
    );
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /arrived/i }));
    // The button disables during the GPS capture, so the double click is a
    // no-op and only one mutation can ever be queued.
    expect(screen.getByRole('button', { name: /arrived/i })).toHaveProperty('disabled', true);

    resolveLocation({ status: 'success', location: FIX });
    await waitFor(() => expect(arriveMock).toHaveBeenCalledTimes(1));
  });

  it('accepts stale and inaccurate fixes for arrival (coords still recorded)', async () => {
    arriveMock.mockImplementation((_input, opts) => opts?.onSuccess?.({ success: true }));
    currentLocationMock.mockResolvedValue({ status: 'stale', location: FIX });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /arrived/i }));

    await waitFor(() =>
      expect(arriveMock).toHaveBeenCalledWith(
        expect.objectContaining({ ticketId: 9, latitude: FIX.latitude }),
        expect.anything()
      )
    );
  });

  it('redirects an in-progress ticket to the work session', () => {
    detailMock.mockReturnValue({
      success: true,
      ticket: { ...BASE_TICKET, status: 'in_progress' }
    });
    renderPage();

    expect(screen.getByText(/already in progress/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /continue to work session/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /arrived/i })).toBeNull();
  });

  it('redirects a non-assigned ticket back to the detail page', () => {
    detailMock.mockReturnValue({ success: true, ticket: { ...BASE_TICKET, status: 'open' } });
    renderPage();

    expect(screen.getByText(/not assigned to you/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /arrived/i })).toBeNull();
  });

  it('shows an invalid-ticket message when the ticket does not exist', () => {
    detailMock.mockReturnValue({ success: false, ticket: null });
    renderPage();

    expect(screen.getByText(/ticket not found/i)).toBeTruthy();
  });
});
