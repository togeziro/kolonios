import { describe, expect, it } from 'vitest';
import { MODULES, PERMISSION_ACTIONS } from './modules';

describe('role permission modules', () => {
  it('derives the full permission action vocabulary from MODULES', () => {
    expect([...PERMISSION_ACTIONS]).toEqual([
      'view',
      'add',
      'edit',
      'delete',
      'approve',
      'pay',
      'reports'
    ]);
  });

  it('exposes all payroll workflow actions to the permission editor', () => {
    expect(MODULES.find((module) => module.key === 'payroll')?.actions).toEqual([
      'view',
      'add',
      'edit',
      'delete',
      'approve',
      'pay',
      'reports'
    ]);
  });

  it('exposes the tickets module with crew workflow actions', () => {
    expect(MODULES.find((m) => m.key === 'tickets')?.actions).toEqual(['view', 'add', 'edit']);
  });
});
