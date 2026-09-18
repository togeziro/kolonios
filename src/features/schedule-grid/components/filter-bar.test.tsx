// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useState } from 'react';
import '@/i18n/config';
import { FilterBar } from './filter-bar';

// The native <select> in the browser is mocked in jsdom — `user.selectOptions`
// drives the React onChange handler with the value of the chosen option.
describe('FilterBar', () => {
  it('renders the department dropdown with an "All" option plus provided departments', () => {
    render(
      createElement(FilterBar, {
        divisions: [
          { id: 1, name: 'Engineering' },
          { id: 2, name: 'Operations' }
        ],
        divisionId: null,
        onDivisionChange: vi.fn(),
        search: '',
        pendingSearch: '',
        onPendingSearchChange: vi.fn()
      })
    );
    const select = screen.getByLabelText(/filter by department/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /all departments/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Engineering' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Operations' })).toBeInTheDocument();
  });

  it('emits the department id when a non-empty option is chosen', async () => {
    const user = userEvent.setup();
    const onDivisionChange = vi.fn();
    render(
      createElement(FilterBar, {
        divisions: [{ id: 7, name: 'Finance' }],
        divisionId: null,
        onDivisionChange,
        search: '',
        pendingSearch: '',
        onPendingSearchChange: vi.fn()
      })
    );
    const select = screen.getByLabelText(/filter by department/i) as HTMLSelectElement;
    await user.selectOptions(select, '7');
    expect(onDivisionChange).toHaveBeenCalledWith('7');
  });

  it('emits null when the "All departments" option is chosen', async () => {
    const user = userEvent.setup();
    const onDivisionChange = vi.fn();
    render(
      createElement(FilterBar, {
        divisions: [{ id: 7, name: 'Finance' }],
        divisionId: '7',
        onDivisionChange,
        search: '',
        pendingSearch: '',
        onPendingSearchChange: vi.fn()
      })
    );
    const select = screen.getByLabelText(/filter by department/i) as HTMLSelectElement;
    await user.selectOptions(select, '');
    expect(onDivisionChange).toHaveBeenCalledWith(null);
  });

  it('updates pendingSearch on typing and exposes the search debounce constant', async () => {
    const user = userEvent.setup();
    const onPendingSearchChange = vi.fn();
    // The search input is controlled (`value={pendingSearch}`), so a bare
    // mock handler leaves the value pinned at '' and each keystroke reports
    // a single char. Track it in state like the real parent does.
    function Harness() {
      const [pending, setPending] = useState('');
      return createElement(FilterBar, {
        divisions: [],
        divisionId: null,
        onDivisionChange: vi.fn(),
        search: '',
        pendingSearch: pending,
        onPendingSearchChange: (next: string) => {
          setPending(next);
          onPendingSearchChange(next);
        }
      });
    }
    render(createElement(Harness));
    const input = screen.getByLabelText(/search by employee/i) as HTMLInputElement;
    await user.type(input, 'aldi');
    expect(onPendingSearchChange).toHaveBeenCalledWith('aldi');
    // The data attribute tells integration tests which debounce window to use.
    expect(input.dataset.searchDebounceMs).toBe('300');
  });
});
