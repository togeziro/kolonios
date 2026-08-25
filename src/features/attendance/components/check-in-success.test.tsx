// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { CheckInSuccess } from './check-in-success';

function renderScreen(onDone: () => void) {
  render(
    <I18nextProvider i18n={i18n}>
      <CheckInSuccess time='08:01' locationName='HQ' onDone={onDone} />
    </I18nextProvider>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('CheckInSuccess', () => {
  it('does not auto-dismiss: onDone is not called even after the old 3s timeout', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    renderScreen(onDone);

    vi.advanceTimersByTime(5000);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('calls onDone exactly once when the Done button is clicked', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    renderScreen(onDone);

    vi.advanceTimersByTime(5000);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
