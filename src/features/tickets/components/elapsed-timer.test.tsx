// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import ElapsedTimer, { formatElapsed } from './elapsed-timer';

describe('formatElapsed', () => {
  it('formats bounded durations as HH:MM:SS', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(1_457_000)).toBe('00:24:17');
    expect(formatElapsed(3_661_000)).toBe('01:01:01');
    expect(formatElapsed(86_399_000)).toBe('23:59:59');
  });

  it('does not produce negative time', () => {
    expect(formatElapsed(-5_000)).toBe('00:00:00');
  });
});

describe('ElapsedTimer', () => {
  it('renders an elapsed readout driven by takenAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T08:00:00Z'));
    render(
      <I18nextProvider i18n={i18n}>
        <ElapsedTimer takenAt='2026-08-16T07:35:43Z' />
      </I18nextProvider>
    );
    expect(screen.getByText('00:24:17')).toBeTruthy();
    vi.useRealTimers();
  });
});
