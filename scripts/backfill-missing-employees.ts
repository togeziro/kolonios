import { createInterface } from 'node:readline/promises';
import { sql, asc } from 'drizzle-orm';
import postgres from 'postgres';
import { parseDbUrl, requireLocalHost } from './lib/db-url';
import { db, client as dbClient } from '../src/lib/db';
import { listMissingEmployeeProfiles } from '../src/lib/db/users';
import { employees } from '../src/lib/db/schema/employees';
import { departments, designations } from '../src/lib/db/schema/masterdata';
import { logger } from '../src/lib/logger';

// One-shot data fix for the prod gap surfaced in items 1+2: workforce users
// provisioned via /dashboard/users before any employee profile was created.
// Creates skeleton `employees` rows for each, using the first available
// department + designation (override via flags), with all other columns
// defaulted to the same placeholders the seed script uses.
//
// The result is a complete-but-empty row that an admin then edits via
// /dashboard/employees. We deliberately do NOT try to invent department or
// job data — that decision belongs to HR, not a script.
//
// Gated by --yes (or interactive confirmation per row). Refuses non-local
// hosts (the same guard as db:reset).

function parseFlags() {
  const args = process.argv.slice(2);
  const num = (name: string) => {
    const idx = args.indexOf(name);
    if (idx === -1) return null;
    const n = Number(args[idx + 1]);
    return Number.isFinite(n) ? n : null;
  };
  return {
    yes: args.includes('--yes'),
    dryRun: args.includes('--dry-run'),
    includeCustomer: args.includes('--include-customer'),
    departmentId: num('--department-id'),
    designationId: num('--designation-id')
  };
}

async function pickDefaults(
  overrideDept: number | null,
  overrideDesig: number | null
): Promise<{ departmentId: number; designationId: number }> {
  if (overrideDept !== null && overrideDesig !== null) {
    return { departmentId: overrideDept, designationId: overrideDesig };
  }
  const [dept] =
    overrideDept !== null
      ? await db
          .select()
          .from(departments)
          .where(sql`${departments.id} = ${overrideDept}`)
          .limit(1)
      : await db.select().from(departments).orderBy(asc(departments.id)).limit(1);
  const [desig] =
    overrideDesig !== null
      ? await db
          .select()
          .from(designations)
          .where(sql`${designations.id} = ${overrideDesig}`)
          .limit(1)
      : await db.select().from(designations).orderBy(asc(designations.id)).limit(1);
  if (!dept || !desig) {
    throw new Error(
      `Cannot pick defaults: department=${dept?.id ?? 'missing'}, designation=${desig?.id ?? 'missing'}. Pass --department-id and --designation-id explicitly.`
    );
  }
  return { departmentId: dept.id, designationId: desig.id };
}

async function nextEmployeeCode(): Promise<string> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(employees);
  const n = (row?.count ?? 0) + 1;
  return `EMP-${String(n).padStart(4, '0')}`;
}

async function confirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      'Non-interactive shell detected. Re-run with --yes to skip the confirmation prompt.'
    );
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(message)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

type MissingRow = { id: string; email: string | null; name: string | null; role: string | null };

async function backfillOne(
  row: MissingRow,
  defaults: { departmentId: number; designationId: number },
  today: string
): Promise<string> {
  const employeeCode = await nextEmployeeCode();
  const fullName = row.name?.trim() || row.email?.split('@')[0] || 'Unknown';
  await db.insert(employees).values({
    id: row.id,
    employee_code: employeeCode,
    full_name: fullName,
    email: (row.email ?? '').toLowerCase(),
    birth_date: '1970-01-01', // placeholder — admin must correct via UI
    department_id: defaults.departmentId,
    designation_id: defaults.designationId,
    join_date: today,
    status: 'active',
    employment_status: 'active',
    is_internship: false,
    base_salary: 0
  });
  return employeeCode;
}

async function main() {
  const flags = parseFlags();
  const parts = parseDbUrl();
  requireLocalHost(parts);

  const probe = postgres(parts.url, { max: 1, onnotice: () => {} });
  try {
    await probe.unsafe(`SELECT 1`);
  } finally {
    await probe.end();
  }

  const { rows: missing } = await listMissingEmployeeProfiles({
    includeCustomer: flags.includeCustomer,
    limit: 10_000
  });
  if (missing.length === 0) {
    console.log('No workforce users are missing an employee profile. Nothing to do.');
    return;
  }

  const defaults = await pickDefaults(flags.departmentId, flags.designationId);
  const today = new Date().toISOString().slice(0, 10);

  console.log(
    `Will create ${missing.length} employee row${missing.length === 1 ? '' : 's'} with:` +
      `\n  department_id = ${defaults.departmentId}` +
      `\n  designation_id = ${defaults.designationId}` +
      `\n  join_date      = ${today}` +
      `\n  birth_date     = 1970-01-01 (placeholder — admin must correct)`
  );

  if (flags.dryRun) {
    console.log('\n--dry-run: no rows written. Sample of users that would be backfilled:');
    for (const row of missing.slice(0, 5)) {
      console.log(`  ${row.email ?? row.id}  (${row.role ?? 'unknown'})`);
    }
    if (missing.length > 5) console.log(`  ... and ${missing.length - 5} more`);
    return;
  }

  if (!flags.yes) {
    const ok = await confirm(
      `Create ${missing.length} employee row${missing.length === 1 ? '' : 's'}? [y/N] `
    );
    if (!ok) {
      console.log('Aborted.');
      return;
    }
  }

  const created: Array<{ email: string | null; code: string }> = [];
  let failed = 0;
  for (const row of missing) {
    try {
      const code = await backfillOne(row, defaults, today);
      created.push({ email: row.email, code });
    } catch (err) {
      failed++;
      logger.error(
        { userId: row.id, err },
        '[scripts:backfill-missing-employees] row insert failed'
      );
    }
  }

  console.log(`\nBackfill complete: ${created.length} created, ${failed} failed.`);
  for (const c of created) {
    console.log(`  ${c.email ?? '?'}  →  ${c.code}`);
  }
  if (failed > 0) {
    console.log('\nSee server logs for failure details. Re-run after fixing.');
    process.exit(1);
  }
  console.log('\nEdit each row via /dashboard/employees to fill in the HR-specific fields.');
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
