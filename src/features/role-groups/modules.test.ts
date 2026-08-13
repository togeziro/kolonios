import { describe, expect, it } from 'vitest';
import { MODULES } from './modules';

describe('role permission modules', () => {
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
