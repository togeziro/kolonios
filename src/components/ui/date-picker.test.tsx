// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { DatePicker, DatePickerRange } from './date-picker';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Radix Popover relies on scrollIntoView; jsdom doesn't implement it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

function renderWithI18n(ui: ReactElement) {
  return render(createElement(I18nextProvider, { i18n }, ui));
}

async function openPopover(triggerName: RegExp) {
  const trigger = screen.getByRole('button', { name: triggerName });
  await act(async () => {
    fireEvent.click(trigger);
  });
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('DatePicker calendar locale', () => {
  it('shows English weekday labels when the UI language is en', async () => {
    renderWithI18n(createElement(DatePicker, {}));
    await openPopover(/select date/i);

    // react-day-picker's default weekday formatter (`cccccc`): en-US → "Mo",
    // id-ID → "Sen". The calendar must follow the i18n language, not the
    // app-locale default (id-ID).
    await waitFor(() => expect(screen.getByText('Mo')).toBeTruthy());
    expect(screen.queryByText('Sen')).toBeNull();
  });

  it('shows Indonesian weekday labels when the UI language is id', async () => {
    await i18n.changeLanguage('id');
    renderWithI18n(createElement(DatePicker, {}));
    await openPopover(/select date/i);

    await waitFor(() => expect(screen.getByText('Sen')).toBeTruthy());
    expect(screen.queryByText('Mo')).toBeNull();
  });

  it('shows English weekday labels in DatePickerRange when the UI language is en', async () => {
    renderWithI18n(createElement(DatePickerRange, {}));
    await openPopover(/select date range/i);

    await waitFor(() => expect(screen.getByText('Mo')).toBeTruthy());
    expect(screen.queryByText('Sen')).toBeNull();
  });
});
