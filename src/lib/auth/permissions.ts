import { createAccessControl } from 'better-auth/plugins/access';

const statements = {
  user: ['create', 'read', 'update', 'delete'],
  attendance: ['create', 'read', 'update', 'delete'],
  leave: ['create', 'read', 'update', 'delete'],
  employee: ['read', 'create', 'update', 'delete'],
  department: ['read', 'create', 'update', 'delete'],
  designation: ['read', 'create', 'update', 'delete'],
  shift: ['read', 'create', 'update', 'delete'],
  location: ['read', 'create', 'update', 'delete']
} as const;

export const ac = createAccessControl(statements);

export const admin = ac.newRole({
  user: ['create', 'read', 'update', 'delete'],
  attendance: ['create', 'read', 'update', 'delete'],
  leave: ['create', 'read', 'update', 'delete'],
  employee: ['read', 'create', 'update', 'delete'],
  department: ['read', 'create', 'update', 'delete'],
  designation: ['read', 'create', 'update', 'delete'],
  shift: ['read', 'create', 'update', 'delete'],
  location: ['read', 'create', 'update', 'delete']
});

export const hr = ac.newRole({
  user: ['read'],
  attendance: ['read', 'update'],
  leave: ['create', 'read', 'update', 'delete'],
  employee: ['read'],
  department: ['read'],
  designation: ['read'],
  shift: ['read'],
  location: ['read']
});

export const employee = ac.newRole({
  user: ['read'],
  attendance: ['create', 'read'],
  leave: ['create', 'read'],
  employee: ['read'],
  department: ['read'],
  designation: ['read'],
  shift: ['read'],
  location: ['read']
});

export const technician = ac.newRole({
  user: ['read'],
  attendance: ['create', 'read'],
  leave: ['create', 'read'],
  employee: ['read'],
  department: ['read'],
  designation: ['read'],
  shift: ['read'],
  location: ['read']
});

export const customer = ac.newRole({
  user: ['read', 'update'],
  attendance: [],
  leave: [],
  employee: [],
  department: [],
  designation: [],
  shift: [],
  location: []
});
