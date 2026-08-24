import { describe, expect, it } from 'vitest';
import { usersToCsv } from './export-csv';
import type { User } from '@/lib/domain/users';

const base: User = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@test.com',
  role: 'admin',
  role_group_id: null,
  role_group_name: null,
  status: 'Active',
  created_at: '2026-01-02T03:04:05.000Z',
  updated_at: '2026-01-02T03:04:05.000Z'
};

describe('usersToCsv', () => {
  it('writes a header row and data rows', () => {
    const csv = usersToCsv([base]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Name,Email,Role,Status,Created At');
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('alice@test.com');
    expect(lines[1]).toContain('Active');
  });

  it('quotes values containing commas and quotes', () => {
    const row: User = { ...base, name: 'Doe, John "JD"' };
    const csv = usersToCsv([row]);
    expect(csv).toContain('"Doe, John ""JD"""');
  });

  it('returns empty data section for no users', () => {
    const csv = usersToCsv([]);
    expect(csv.trim().split('\n')).toEqual(['Name,Email,Role,Status,Created At']);
  });

  it('prefers role_group_name over role', () => {
    const row: User = { ...base, role: 'employee', role_group_name: 'HR Admin' };
    const csv = usersToCsv([row]);
    expect(csv).toContain('HR Admin');
    expect(csv).not.toContain('\nemployee,');
  });
});
