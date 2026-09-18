// @vitest-environment jsdom
// i18n:skip
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleGroupRowActions } from './role-group-row-actions';
import type { RoleGroup } from '../api/types';

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => null
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

function groupFixture(overrides: Partial<RoleGroup> = {}): RoleGroup {
  return {
    id: 'rg-custom',
    name: 'Custom',
    description: 'Custom role',
    permissions: {},
    is_admin: false,
    created_at: '2026-08-31T00:00:00.000Z',
    updated_at: '2026-08-31T00:00:00.000Z',
    ...overrides
  };
}

const onEdit = vi.fn();
const onDelete = vi.fn();

function renderActions(group: RoleGroup, perms = { canEdit: true, canDelete: true }) {
  render(
    <RoleGroupRowActions
      group={group}
      canEdit={perms.canEdit}
      canDelete={perms.canDelete}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RoleGroupRowActions', () => {
  it('disables Edit and Delete for system roles even when permitted', () => {
    renderActions(groupFixture({ is_admin: true }));
    const edit = screen.getByRole('button', { name: 'roleGroups.editRole' });
    const del = screen.getByRole('button', { name: 'common.delete' });
    expect(edit).toBeDisabled();
    expect(del).toBeDisabled();
    expect(screen.getByText('common.viewDetails')).toBeInTheDocument();
  });

  it('disables Edit and Delete when the user lacks role_groups permission', () => {
    renderActions(groupFixture(), { canEdit: false, canDelete: false });
    expect(screen.getByRole('button', { name: 'roleGroups.editRole' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeDisabled();
  });

  it('emits onEdit with the group when Edit is enabled', async () => {
    const user = userEvent.setup();
    const group = groupFixture();
    renderActions(group);
    await user.click(screen.getByRole('button', { name: 'roleGroups.editRole' }));
    expect(onEdit).toHaveBeenCalledWith(group);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('emits onDelete with the group when Delete is enabled', async () => {
    const user = userEvent.setup();
    const group = groupFixture();
    renderActions(group);
    await user.click(screen.getByRole('button', { name: 'common.delete' }));
    expect(onDelete).toHaveBeenCalledWith(group);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
