import postgres from 'postgres';
import { parseDbUrl, requireLocalHost } from './lib/db-url';
import { client as dbClient } from '../src/lib/db';
import { listMissingEmployeeProfiles } from '../src/lib/db/users';

// Lists workforce users (role != 'customer') that have no matching
// `employees` row. Read-only — safe to run on any environment. The same
// query backs the `/dashboard/admin/attendance/assignments` warning banner.
//
// Excludes banned accounts (defunct sessions) and the customer role so the
// output is only true workforce gaps that an admin needs to fill in via
// `/dashboard/employees`. Exits 0 even when there is nothing to do, so it
// can be wired into a cron/alerting job.

function parseFlags() {
  const args = process.argv.slice(2);
  return {
    json: args.includes('--json'),
    includeCustomer: args.includes('--include-customer'),
    limit: (() => {
      const idx = args.indexOf('--limit');
      if (idx === -1) return 50;
      const n = Number(args[idx + 1]);
      return Number.isFinite(n) && n > 0 ? n : 50;
    })()
  };
}

type MissingRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  createdAt: Date;
};

function printTable(rows: MissingRow[]) {
  if (rows.length === 0) {
    console.log('No workforce users are missing an employee profile.');
    return;
  }
  const cols: { key: keyof MissingRow; label: string; w: number }[] = [
    { key: 'id', label: 'id', w: 36 },
    { key: 'email', label: 'email', w: 36 },
    { key: 'name', label: 'name', w: 28 },
    { key: 'role', label: 'role', w: 12 },
    { key: 'createdAt', label: 'created_at', w: 24 }
  ];
  const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
  for (const c of cols) {
    c.w = Math.max(
      c.w,
      ...rows.map(
        (r) => (c.key === 'createdAt' ? r.createdAt.toISOString() : String(r[c.key] ?? '')).length
      )
    );
  }
  console.log(cols.map((c) => pad(c.label, c.w)).join('  '));
  console.log(cols.map((c) => '-'.repeat(c.w)).join('  '));
  for (const r of rows) {
    console.log(
      cols
        .map((c) =>
          pad(c.key === 'createdAt' ? r.createdAt.toISOString() : String(r[c.key] ?? ''), c.w)
        )
        .join('  ')
    );
  }
}

async function main() {
  const flags = parseFlags();
  const parts = parseDbUrl();
  requireLocalHost(parts);

  // Confirm DATABASE_URL points to a reachable server before doing work.
  const probe = postgres(parts.url, { max: 1, onnotice: () => {} });
  try {
    await probe.unsafe(`SELECT 1`);
  } finally {
    await probe.end();
  }

  const { total, rows } = await listMissingEmployeeProfiles({
    includeCustomer: flags.includeCustomer,
    limit: flags.limit
  });

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          total,
          showing: rows.length,
          rows: rows.map((r) => ({
            id: r.id,
            email: r.email,
            name: r.name,
            role: r.role,
            created_at: r.createdAt.toISOString()
          }))
        },
        null,
        2
      )
    );
  } else {
    console.log(
      `${total} workforce user${total === 1 ? '' : 's'} missing an employee profile (showing up to ${flags.limit}):`
    );
    printTable(rows);
    console.log('');
    console.log('Next step: run `bun run db:backfill-missing-employees -- --yes` to');
    console.log('create skeleton employee rows. Edit them via /dashboard/employees.');
  }
}

if (import.meta.main) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .then(async () => {
      await dbClient?.end();
      process.exit(0);
    });
}
