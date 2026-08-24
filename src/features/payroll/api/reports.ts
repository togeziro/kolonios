import { createServerFn } from '@tanstack/react-start';
import { requirePermission } from '@/lib/auth/session';
import { listPayrollReportRows } from '@/lib/db/payroll';
import { toMajor } from '../utils/money';
import { reportFiltersSchema } from './validation';

function escapeCsvValue(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializePayrollReport(
  result: { rows: Array<Record<string, unknown>> },
  format: 'json' | 'csv'
) {
  if (format === 'json') return result;
  const headers = [...new Set(result.rows.flatMap((row) => Object.keys(row)))];
  return {
    ...result,
    format,
    mime: 'text/csv',
    encoding: 'identity' as const,
    ext: 'csv',
    content: [
      headers.join(','),
      ...result.rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','))
    ].join('\n')
  };
}

type PayrollReportRow = {
  employee_id: string;
  department_name?: string | null;
  gross_salary: string | number;
  total_allowances: string | number;
  total_deductions: string | number;
  net_salary: string | number;
  details?: unknown;
};

export function aggregatePayrollRows(rows: PayrollReportRow[]) {
  const departmentsByName = new Map<string, { department: string; gross: number; net: number }>();
  const componentsByKey = new Map<string, { name: string; type: string; amount: number }>();
  let gross = 0;
  let allowances = 0;
  let deductions = 0;
  let net = 0;
  let taxTotal = 0;
  for (const row of rows) {
    const rowGross = Number(row.gross_salary ?? 0);
    const rowNet = Number(row.net_salary ?? 0);
    gross += rowGross;
    allowances += Number(row.total_allowances ?? 0);
    deductions += Number(row.total_deductions ?? 0);
    net += rowNet;
    const department = row.department_name ?? 'Unassigned';
    const departmentTotal = departmentsByName.get(department) ?? { department, gross: 0, net: 0 };
    departmentTotal.gross += rowGross;
    departmentTotal.net += rowNet;
    departmentsByName.set(department, departmentTotal);
    const details =
      row.details && typeof row.details === 'object'
        ? (row.details as Record<string, unknown>)
        : {};
    const tax =
      details.tax && typeof details.tax === 'object'
        ? (details.tax as Record<string, unknown>)
        : {};
    taxTotal += toMajor(Number(tax.amount ?? 0));
    const lineItems = Array.isArray(details.lineItems) ? details.lineItems : [];
    for (const item of lineItems) {
      if (!item || typeof item !== 'object') continue;
      const line = item as Record<string, unknown>;
      const lineType = typeof line.type === 'string' ? line.type : null;
      if (
        !lineType ||
        !['allowance', 'deduction', 'attendance-deduction'].includes(lineType) ||
        typeof line.name !== 'string'
      )
        continue;
      const componentType = lineType === 'attendance-deduction' ? 'deduction' : lineType;
      const key = `${componentType}:${line.name}`;
      const component = componentsByKey.get(key) ?? {
        name: line.name,
        type: componentType,
        amount: 0
      };
      component.amount += toMajor(Number(line.amount ?? 0));
      componentsByKey.set(key, component);
    }
  }
  return {
    rows,
    gross,
    allowances,
    deductions,
    net,
    taxTotal,
    departmentTotals: [...departmentsByName.values()],
    componentTotals: [...componentsByKey.values()]
  };
}

export const getPayrollReportFn = createServerFn({ method: 'GET' })
  .validator(reportFiltersSchema)
  .handler(async ({ data }) => {
    await requirePermission('payroll', 'reports');
    const rows = await listPayrollReportRows({
      payroll_period_id: data.payrollPeriodId,
      employee_id: data.employeeId,
      department_id: data.departmentId,
      status: data.status
    });
    const aggregate = aggregatePayrollRows(JSON.parse(JSON.stringify(rows ?? [])));
    if (data.format === 'csv')
      return serializePayrollReport({ rows: aggregate.rows }, 'csv') as unknown as {
        format: 'csv';
        content: string;
        encoding: 'identity';
        mime: 'text/csv';
        ext: 'csv';
      };
    if (data.format === 'xlsx') {
      const { writeXlsxBuffer } = await import('@/features/attendance/api/export-adapter');
      const buffer = writeXlsxBuffer(
        aggregate.rows as unknown as Array<Record<string, unknown>>,
        'Payroll'
      );
      return {
        format: 'xlsx' as const,
        content: buffer.toString('base64'),
        encoding: 'base64' as const,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ext: 'xlsx'
      };
    }
    return JSON.parse(JSON.stringify(aggregate));
  });
