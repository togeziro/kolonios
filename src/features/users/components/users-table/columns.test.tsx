// @vitest-environment jsdom
// i18n:skip
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { columns } from './columns';
import type { User } from '../../api/types';

// The users table is not under test here — only the Employee Profile badge
// cell (Pending deep-link vs Complete). Stub the row-action cell so the
// server-fn-backed user mutations never load in this runner.
vi.mock('./cell-action', () => ({
  CellAction: () => null
}));

// TanStack Router's Link needs router context; the badge only uses it as an
// anchor to /dashboard/employees with the user identity as search params.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    search,
    children,
    ...rest
  }: {
    to: string;
    search?: Record<string, string>;
    children?: ReactNode;
  }) => {
    const qs = search ? `?${new URLSearchParams(search).toString()}` : '';
    return (
      <a href={`${to}${qs}`} {...rest}>
        {children}
      </a>
    );
  }
}));

function pendingUser(): User {
  return {
    id: 'usr-zuldan',
    name: 'Zuldan',
    email: 'zuldan@test.com',
    status: 'Active',
    role: 'technician',
    role_group_id: null,
    role_group_name: null,
    has_employee_profile: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function profileCellNode(user: User): ReactNode {
  const profileColumn = columns.find(
    (column) => column.id === 'has_employee_profile'
  ) as unknown as {
    cell: (context: { row: { original: User } }) => ReactNode;
  };
  return profileColumn.cell({ row: { original: user } });
}

function renderCell(user: User) {
  return render(
    <I18nextProvider i18n={i18n}>
      <table>
        <tbody>
          <tr>{profileCellNode(user)}</tr>
        </tbody>
      </table>
    </I18nextProvider>
  );
}

describe('users table — EmployeeProfileCell (Pending → Complete)', () => {
  it('renders Pending as a deep-link to Employees carrying the user identity', () => {
    renderCell(pendingUser());

    const link = screen.getByRole('link', { name: /Pending/i });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('/dashboard/employees');
    expect(href).toContain('linkUser=usr-zuldan');
    expect(href).toContain(`linkUserEmail=${encodeURIComponent('zuldan@test.com')}`);
    expect(link.getAttribute('title')).toContain('complete the profile');
  });

  it('renders Complete with no action once the employee profile exists', () => {
    renderCell({ ...pendingUser(), has_employee_profile: true });

    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
