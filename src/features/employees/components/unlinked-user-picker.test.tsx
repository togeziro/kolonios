// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import UnlinkedUserPicker, { unlinkedUserPickerQueryOptions } from './unlinked-user-picker';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
globalThis.HTMLElement.prototype.scrollIntoView = vi.fn();
globalThis.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
globalThis.HTMLElement.prototype.releasePointerCapture = vi.fn();

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: () => useQueryMock() };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

const ZULDAN = { id: 'usr-zuldan', name: 'Zuldan', email: 'zuldan@test.com' };

beforeEach(() => {
  useQueryMock.mockReset();
  useQueryMock.mockReturnValue({
    data: {
      success: true,
      users: [
        { ...ZULDAN, status: 'Active', role: 'technician', has_employee_profile: false },
        {
          id: 'usr-b',
          name: 'Budi',
          email: 'budi@test.com',
          status: 'Active',
          role: 'employee',
          has_employee_profile: false
        }
      ]
    },
    isFetching: false
  });
});

function renderPicker(props: Partial<React.ComponentProps<typeof UnlinkedUserPicker>> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <UnlinkedUserPicker value={null} onChange={() => undefined} {...props} />
    </I18nextProvider>
  );
}

describe('unlinkedUserPickerQueryOptions', () => {
  it('routes the search term into the unlinked-users query', () => {
    const opts = unlinkedUserPickerQueryOptions('zuldan');

    expect(opts.queryKey).toEqual(['users', 'unlinked', { search: 'zuldan', page: 1, limit: 20 }]);
  });
});

describe('UnlinkedUserPicker', () => {
  it('shows the placeholder when nothing is selected', () => {
    renderPicker();

    expect(screen.getByRole('combobox').textContent).toMatch(/Select a user without a profile/i);
  });

  it('shows the selected user once chosen', () => {
    renderPicker({ value: ZULDAN });

    expect(screen.getByRole('combobox').textContent).toContain('Zuldan');
    expect(screen.getByRole('combobox').textContent).toContain('zuldan@test.com');
  });

  it('calls onChange with the user identity when an item is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ onChange });

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Budi/i }));

    expect(onChange).toHaveBeenCalledWith({
      id: 'usr-b',
      name: 'Budi',
      email: 'budi@test.com'
    });
  });

  it('calls onChange with null when the selected item is picked again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: ZULDAN, onChange });

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Zuldan/i }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
