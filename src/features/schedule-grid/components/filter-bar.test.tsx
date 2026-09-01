// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { createElement } from 'react';
import '@/i18n/config';
import { FilterBar } from './filter-bar';

// The native <select> in the browser is mocked in jsdom — `fireEvent.change`
// drives the React onChange handler with a target.value that matches the
// option we set.
describe('FilterBar', () => {
  it('renders the division dropdown with an "All" option plus provided divisions', () => {
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
    const select = screen.getByLabelText(/filter by division/i) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(screen.getByRole('option', { name: /all divisions/i })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Engineering' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Operations' })).toBeTruthy();
  });

  it('emits the division id when a non-empty option is chosen', () => {
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
    const select = screen.getByLabelText(/filter by division/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '7' } });
    expect(onDivisionChange).toHaveBeenCalledWith('7');
  });

  it('emits null when the "All divisions" option is chosen', () => {
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
    const select = screen.getByLabelText(/filter by division/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });
    expect(onDivisionChange).toHaveBeenCalledWith(null);
  });

  it('updates pendingSearch on typing and exposes the search debounce constant', () => {
    const onPendingSearchChange = vi.fn();
    render(
      createElement(FilterBar, {
        divisions: [],
        divisionId: null,
        onDivisionChange: vi.fn(),
        search: '',
        pendingSearch: '',
        onPendingSearchChange
      })
    );
    const input = screen.getByLabelText(/search by employee/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'aldi' } });
    expect(onPendingSearchChange).toHaveBeenCalledWith('aldi');
    // The data attribute tells integration tests which debounce window to use.
    expect(input.dataset.searchDebounceMs).toBe('300');
  });
});
