// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { permsMock } = vi.hoisted(() => ({
  permsMock: vi.fn()
}));

// The Users route file (src/routes/dashboard/users.tsx) is transformed by the
// TanStack Start vite plugin, so its component is a Lazy code-split wrapper
// that never resolves under vitest — the full UsersPage cannot be rendered
// here (same reason other route tests target feature/dash-file components).
// This test therefore pins the toolbar gate minimally, mirroring users.tsx
// verbatim (jobs-page idiom: `isAdmin || permissions.<module>?.add === true`
// + `{canCreate && <UserFormSheetTrigger />}`).
vi.mock('@/hooks/use-nav', () => ({
  useRoleGroupPermissions: () => permsMock()
}));

import { useRoleGroupPermissions } from '@/hooks/use-nav';

// Mirror of the gate in UsersPage (src/routes/dashboard/users.tsx).
function UsersCreateGate({ trigger }: { trigger: React.ReactNode }) {
  const { isAdmin, permissions } = useRoleGroupPermissions();
  const canCreate = isAdmin || permissions.users?.add === true;
  return <>{canCreate && trigger}</>;
}

function renderGate() {
  return render(<UsersCreateGate trigger={<button type='button'>Add User</button>} />);
}

describe('UsersPage create gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides the create trigger when the role lacks users.add', () => {
    permsMock.mockReturnValue({ isAdmin: false, permissions: {} });
    renderGate();
    expect(screen.queryByRole('button', { name: /add user/i })).not.toBeInTheDocument();
  });

  it('shows the create trigger when the role has users.add', () => {
    permsMock.mockReturnValue({ isAdmin: false, permissions: { users: { add: true } } });
    renderGate();
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
  });

  it('shows the create trigger for admins without explicit users.add', () => {
    permsMock.mockReturnValue({ isAdmin: true, permissions: {} });
    renderGate();
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
  });
});
