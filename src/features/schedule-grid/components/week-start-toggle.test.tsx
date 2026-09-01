// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { createElement } from 'react';
import '@/i18n/config';
import { WeekStartToggle } from './week-start-toggle';

describe('WeekStartToggle', () => {
  beforeEach(() => {
    // jsdom does not provision localStorage by default. The component reads
    // it under try/catch so missing storage is harmless, but we stub it for
    // the persistence assertion in the click test.
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        get length() {
          return store.size;
        }
      },
      writable: true,
      configurable: true
    });
  });

  it('renders both options with Monday pressed by default', () => {
    render(createElement(WeekStartToggle));
    const mon = screen.getByRole('button', { name: /mon/i });
    const sun = screen.getByRole('button', { name: /sun/i });
    expect(mon.getAttribute('aria-pressed')).toBe('true');
    expect(sun.getAttribute('aria-pressed')).toBe('false');
  });

  it('flips the pressed state and persists to localStorage on click', () => {
    render(createElement(WeekStartToggle));
    const sun = screen.getByRole('button', { name: /sun/i });
    fireEvent.click(sun);

    expect(sun.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem('kolonios-schedule-grid-week-start')).toBe('sunday');

    const mon = screen.getByRole('button', { name: /mon/i });
    expect(mon.getAttribute('aria-pressed')).toBe('false');
  });
});
