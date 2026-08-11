import type { User } from '@/features/users/api/types';

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function usersToCsv(users: User[]): string {
  const header = ['Name', 'Email', 'Role', 'Status', 'Created At'];
  const rows = users.map((u) => [
    u.name,
    u.email,
    u.role_group_name || u.role,
    u.status,
    u.created_at
  ]);
  return [header, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
