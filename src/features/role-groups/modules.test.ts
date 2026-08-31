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

  it('exposes every module the app guards in nav and server functions', () => {
    const keys = MODULES.map((m) => m.key);
    for (const key of ['attendance_admin', 'checklist', 'schedule', 'achievements', 'broadcast']) {
      expect(keys, `module ${key} must be configurable in the matrix`).toContain(key);
    }
  });

  it('exposes attendance management actions used by its nav and guards', () => {
    expect(MODULES.find((m) => m.key === 'attendance_admin')?.actions).toEqual(['view', 'edit']);
  });

  it('exposes checklist actions matching its review workflow', () => {
    expect(MODULES.find((m) => m.key === 'checklist')?.actions).toEqual([
      'view',
      'edit',
      'approve'
    ]);
  });

  it('exposes schedule, achievements, and broadcast as view-only modules', () => {
    for (const key of ['schedule', 'achievements', 'broadcast']) {
      expect(MODULES.find((m) => m.key === key)?.actions).toEqual(['view']);
    }
  });

  it('exposes the personal payslips module as view-only', () => {
    expect(MODULES.find((m) => m.key === 'payslips')?.actions).toEqual(['view']);
  });
});
