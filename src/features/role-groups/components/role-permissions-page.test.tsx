// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import RolePermissionsPage from './role-permissions-page';

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn()
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: () => useQueryMock() };
});

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: 'zzzrg-technician' }),
  Link: ({ children }: { children: React.ReactNode }) => children
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

const savedPermissions = {
  overview: { view: true },
  payroll: { view: true, edit: true },
  attendance_admin: { view: true, edit: true },
  checklist: { view: true, edit: true, approve: true },
  schedule: { view: true },
  achievements: { view: true },
  broadcast: { view: true }
};

function setGroupLoaded() {
  useQueryMock.mockReturnValue({
    data: {
      role_group: {
        id: 'zzzrg-technician',
        name: 'Technician',
        description: 'Field technician access',
        permissions: savedPermissions,
        is_admin: false,
        created_at: '2026-08-31T00:00:00.000Z',
        updated_at: '2026-08-31T00:00:00.000Z'
      }
    },
    isLoading: false
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <RolePermissionsPage />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

function checkboxState(moduleLabel: string) {
  const row = screen.getAllByRole('row').find((r) => r.textContent?.startsWith(moduleLabel));
  if (!row) return null;
  const boxes = [...row.querySelectorAll('[role=checkbox]')];
  return boxes.map((b) => b.getAttribute('aria-checked') === 'true');
}

beforeEach(() => {
  useQueryMock.mockReset();
});

describe('RolePermissionsPage — matrix reflects saved permissions', () => {
  it('seeds the matrix from the loaded group on first render (SSR-first regression)', () => {
    setGroupLoaded();
    renderPage();

    // Payroll row: view + edit were saved true; everything else false.
    expect(checkboxState('Payroll')).toEqual([true, false, true, false, false, false, false]);
    // Dashboard row: only view saved true.
    expect(checkboxState('Dashboard')).toEqual([true, false, false, false, false, false, false]);
    // My Work row: nothing saved → all off.
    expect(checkboxState('My Work')).toEqual([false, false, false, false, false, false, false]);
    // The previously phantom modules seed like any other row.
    expect(checkboxState('Attendance Management')).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false
    ]);
    expect(checkboxState('Daily Checklist')).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      false
    ]);
    expect(checkboxState('Schedule')).toEqual([true, false, false, false, false, false, false]);
    expect(checkboxState('Achievements')).toEqual([true, false, false, false, false, false, false]);
    expect(checkboxState('Broadcast')).toEqual([true, false, false, false, false, false, false]);
  });

  it('renders every module row, including the previously phantom ones', () => {
    setGroupLoaded();
    renderPage();

    for (const label of [
      'Attendance Management',
      'Daily Checklist',
      'Schedule',
      'Achievements',
      'Broadcast'
    ]) {
      expect(
        screen.getAllByRole('row').some((r) => r.textContent?.startsWith(label)),
        `row ${label} must exist`
      ).toBe(true);
    }
  });
});
