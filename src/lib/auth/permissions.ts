import { createAccessControl, role } from 'better-auth/plugins/access';

const statements = {
  user: ['create', 'read', 'update', 'delete']
} as const;

export const ac = createAccessControl(statements);

export const admin = ac.newRole({
  user: ['create', 'read', 'update', 'delete']
});

export const user = ac.newRole({
  user: ['read']
});
