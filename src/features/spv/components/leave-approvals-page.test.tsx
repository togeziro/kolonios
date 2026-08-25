// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

const { permsMock, stubActionMock } = vi.hoisted(() => ({
  permsMock: vi.fn(),
  stubActionMock: vi.fn()
}));

vi.mock('@/hooks/use-nav', () => ({
  useRoleGroupPermissions: () => permsMock()
}));

vi.mock('@/lib/ui/stub-action', () => ({
  stubAction: stubActionMock
}));

import LeaveApprovalsPage from './leave-approvals-page';
import { LEAVE_REQUESTS } from './leave-approvals-fixtures';

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <LeaveApprovalsPage />
    </I18nextProvider>
  );
}

describe('LeaveApprovalsPage', () => {
  beforeEach(() => {
    stubActionMock.mockClear();
    permsMock.mockReturnValue({
      isAdmin: false,
      permissions: { spv_review: { view: true } }
    });
  });

  it('renders summary chips derived from fixtures', () => {
    const pending = LEAVE_REQUESTS.filter((r) => r.status === 'pending').length;
    renderPage();
    expect(screen.getByText(`${pending} Pending`)).toBeTruthy();
    expect(screen.getByText(/\d+ this month/)).toBeTruthy();
  });

  it('defaults to the Pending tab and renders its cards', () => {
    renderPage();
    expect(screen.getByText('Andi Nugroho')).toBeTruthy();
    expect(screen.getByText('Technician · Engineering')).toBeTruthy();
    expect(screen.getByText(/Family event — Balikpapan/)).toBeTruthy();
    expect(screen.getByText('4 days')).toBeTruthy();
  });

  it('tabs switch the visible card set by status', () => {
    renderPage();

    expect(screen.queryByText('Eko Prabowo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rejected' }));
    expect(screen.getByText('Eko Prabowo')).toBeTruthy();
    expect(screen.queryByText('Andi Nugroho')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
    expect(screen.getByText('Dewi Lestari')).toBeTruthy();
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
  });

  it('renders type with paid flag and unpaid deduction hint rows', () => {
    renderPage();
    expect(screen.getByText('Annual Leave')).toBeTruthy();
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
    expect(screen.getByText(/Doctor appointment/)).toBeTruthy();
    expect(screen.getByText(/Unpaid — deducted from salary/)).toBeTruthy();
  });

  it('approve and reject buttons fire the stub action', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    expect(stubActionMock).toHaveBeenCalledTimes(2);
  });

  it('hides content behind a no-access state without spv_review.view', () => {
    permsMock.mockReturnValue({ isAdmin: false, permissions: {} });
    renderPage();
    expect(screen.getByText(/You do not have access to this page/i)).toBeTruthy();
    expect(screen.queryByText('Andi Nugroho')).toBeNull();
  });
});
