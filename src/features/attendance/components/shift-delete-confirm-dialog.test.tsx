// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ShiftDeleteConfirmDialog } from './shift-delete-confirm-dialog';
import type { ShiftListRow } from './shift-columns';

function makeShift(overrides: Partial<ShiftListRow> = {}): ShiftListRow {
  return {
    id: 1,
    name: 'Morning Shift',
    start_time: '08:00',
    end_time: '17:00',
    break_start: null,
    break_end: null,
    color: null,
    late_tolerance_minutes: 5,
    status: 'active',
    used: false,
    ...overrides
  };
}

const baseProps = {
  open: true as boolean,
  onOpenChange: vi.fn(),
  shift: makeShift(),
  loading: undefined as boolean | undefined,
  onConfirm: vi.fn()
};

function renderDialog(overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, ...overrides, shift: overrides.shift ?? baseProps.shift };
  return render(
    <I18nextProvider i18n={i18n}>
      <ShiftDeleteConfirmDialog {...props} />
    </I18nextProvider>
  );
}

beforeEach(() => {
  baseProps.onOpenChange.mockClear();
  baseProps.onConfirm.mockClear();
});

describe('ShiftDeleteConfirmDialog', () => {
  it('renders permanent-delete copy when the shift is unused', () => {
    renderDialog({ shift: makeShift({ name: 'Evening Demo', used: false }) });

    expect(
      screen.getByText(i18n.t('attendanceAdmin.shiftDeleteConfirmPermanentTitle'))
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: i18n.t('attendanceAdmin.shiftDeleteConfirmPermanentAction')
      })
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('common.cancel') })).toBeTruthy();
  });

  it('renders deactivate copy when the shift is used', () => {
    renderDialog({ shift: makeShift({ name: 'Morning Shift', used: true }) });

    expect(
      screen.getByText(i18n.t('attendanceAdmin.shiftDeleteConfirmDeactivateTitle'))
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: i18n.t('attendanceAdmin.shiftDeleteConfirmDeactivateAction')
      })
    ).toBeTruthy();
  });

  it('interpolates the shift name into the description', () => {
    renderDialog({ shift: makeShift({ name: 'Night Owl', used: true }) });

    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent?.startsWith(
            i18n
              .t('attendanceAdmin.shiftDeleteConfirmDeactivateDescription', { name: 'Night Owl' })
              .slice(0, 12) ?? false
          ) ?? false
      )
    ).toBeTruthy();
  });

  it('invokes onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderDialog({ shift: makeShift({ used: false }), onConfirm });

    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('attendanceAdmin.shiftDeleteConfirmPermanentAction')
      })
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('invokes onOpenChange(false) when Cancel is clicked', () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render the dialog body when closed (Radix skips the portal)', () => {
    renderDialog({ open: false });

    expect(
      screen.queryByText(i18n.t('attendanceAdmin.shiftDeleteConfirmPermanentTitle'))
    ).toBeNull();
    expect(
      screen.queryByText(i18n.t('attendanceAdmin.shiftDeleteConfirmDeactivateTitle'))
    ).toBeNull();
  });

  it('disables the confirm button while loading to prevent double-firing the mutation', () => {
    renderDialog({ shift: makeShift({ used: false }), loading: true });

    const button = screen.getByRole('button', {
      name: i18n.t('attendanceAdmin.shiftDeleteConfirmPermanentAction')
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
