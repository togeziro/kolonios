// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name: triggerName });
  await user.click(trigger);
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
    await waitFor(() => expect(screen.getByText('Mo')).toBeInTheDocument());
    expect(screen.queryByText('Sen')).not.toBeInTheDocument();
  });

  it('shows Indonesian weekday labels when the UI language is id', async () => {
    await i18n.changeLanguage('id');
    renderWithI18n(createElement(DatePicker, {}));
    await openPopover(/select date/i);

    await waitFor(() => expect(screen.getByText('Sen')).toBeInTheDocument());
    expect(screen.queryByText('Mo')).not.toBeInTheDocument();
  });

  it('shows English weekday labels in DatePickerRange when the UI language is en', async () => {
    renderWithI18n(createElement(DatePickerRange, {}));
    await openPopover(/select date range/i);

    await waitFor(() => expect(screen.getByText('Mo')).toBeInTheDocument());
    expect(screen.queryByText('Sen')).not.toBeInTheDocument();
  });
});

describe('DatePicker caption dropdowns', () => {
  it('shows month and year dropdowns for fast long-range jumps', async () => {
    renderWithI18n(createElement(DatePicker, {}));
    await openPopover(/select date/i);

    // day-picker renders native month + year <select> elements.
    expect(await screen.findAllByRole('combobox')).toHaveLength(2);
  });

  it('respects startMonth/endMonth bounds on the year dropdown', async () => {
    renderWithI18n(
      createElement(DatePicker, {
        startMonth: new Date(1950, 0),
        endMonth: new Date(2026, 11)
      })
    );
    await openPopover(/select date/i);

    await waitFor(() => expect(screen.getByRole('option', { name: '1950' })).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: '1949' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '2027' })).not.toBeInTheDocument();
  });

  it('shows dropdowns in DatePickerRange too', async () => {
    renderWithI18n(createElement(DatePickerRange, {}));
    await openPopover(/select date range/i);

    expect(await screen.findAllByRole('combobox')).toHaveLength(2);
  });
});
