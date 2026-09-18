// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { LocationForm } from './admin-location-form';

vi.mock('../api/service', () => ({
  createLocationFn: vi.fn(),
  updateLocationFn: vi.fn()
}));

const { locationMapProps } = vi.hoisted(() => ({
  locationMapProps: [] as Array<{ coordinates: { lat: number; lng: number } | null }>
}));

vi.mock('./location-map', () => ({
  LocationMap: (props: { coordinates: { lat: number; lng: number } | null }) => {
    locationMapProps.push(props);
    return <div data-testid='mock-location-map' />;
  }
}));

function renderForm(initial?: Parameters<typeof LocationForm>[0]['initial']) {
  const queryClient = new QueryClient();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <LocationForm initial={initial} />
      </QueryClientProvider>
    </I18nextProvider>
  );
}

beforeEach(() => {
  locationMapProps.length = 0;
});

describe('LocationForm coordinates', () => {
  it('renders manual latitude and longitude inputs', () => {
    renderForm();
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
    expect(screen.getByLabelText('Longitude')).toBeInTheDocument();
  });

  it('updates the map coordinates when latitude/longitude are typed', async () => {
    const user = userEvent.setup();
    renderForm();
    const latitude = screen.getByLabelText('Latitude');
    const longitude = screen.getByLabelText('Longitude');
    await user.clear(latitude);
    await user.type(latitude, '-6.2');
    await user.clear(longitude);
    await user.type(longitude, '106.85');
    expect(locationMapProps.at(-1)?.coordinates).toEqual({ lat: -6.2, lng: 106.85 });
  });

  it('prefills the inputs from the initial location', () => {
    renderForm({ latitude: -6.21, longitude: 106.86 });
    expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('-6.21');
    expect((screen.getByLabelText('Longitude') as HTMLInputElement).value).toBe('106.86');
  });
});
