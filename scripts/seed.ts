import { faker } from '@faker-js/faker';
import { db, client as dbClient } from '../src/lib/db';
import { auth } from '../src/lib/auth/auth.server';
import {
  notifications,
  employees,
  departments,
  designations,
  locations,
  shifts,
  customers,
  tickets,
  ticketLegs,
  taskRequirements,
  employeeSkills,
  roleGroups,
  userRoleGroups,
  shiftWeekdayRules,
  scheduleAssignments,
  dateOverrides,
  dayOffs,
  attendanceCorrections,
  employeeShifts,
  leaveTypeConfigs,
  performanceReports,
  auditLog,
  employeeSalaryAssignments,
  employeeSalaryComponents,
  employeeTaxProfiles,
  employeeBenefitEnrollments,
  employeeBankAccounts,
  employeeBpjsEnrollments,
  employeeEmploymentEvents,
  employeeDocuments,
  companyPayrollSettings,
  payslips,
  payrollRecords,
  payrollPeriods,
  salaryComponents,
  taxSettings
} from '../src/lib/db/schema';
import { user } from '../src/lib/db/auth-schema';
import {
  type NewEmployee,
  type NewDepartment,
  type NewDesignation,
  type NewLocation,
  type NewShift,
  type NewCustomer
} from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { businessDateInTimeZone } from '../src/lib/dates';

async function seedUsers() {
  const demo = {
    email: 'admin@example.com',
    name: 'Demo Admin',
    password: 'Password123!'
  };
  try {
    const created: any = await (auth.api as any).createUser({
      body: { email: demo.email, name: demo.name, password: demo.password, role: 'admin' }
    });
    console.log(`Seeded demo user ${demo.email}`);
    return created.id as string;
  } catch (err: any) {
    const msg = (err?.message ?? '').toLowerCase();
    if (msg.includes('already exists')) {
      console.log(`Demo user ${demo.email} already exists (skipped)`);
      const [existing] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, demo.email))
        .limit(1);
      return existing?.id;
    }
    throw err;
  }
}

async function seedNotifications(userId: string) {
  await db.delete(notifications);

  const notificationTemplates = [
    {
      title: 'New team member joined',
      body: 'Sarah Connor has joined the Engineering workspace.',
      actionId: 'view',
      actionLabel: 'View workspace'
    },
    {
      title: 'Billing cycle updated',
      body: 'Your Pro plan has been renewed. Next invoice on April 24, 2026.',
      actionId: 'billing',
      actionLabel: 'View billing'
    },
    {
      title: 'Task assigned to you',
      body: 'You have been assigned "Update dashboard analytics".',
      actionId: 'open',
      actionLabel: 'View details'
    },
    {
      title: 'Deploy successful',
      body: 'Production v2.4.1 deployed successfully at 14:32 UTC.',
      actionId: 'view',
      actionLabel: 'View deployment'
    },
    {
      title: 'New comment on ticket',
      body: 'Alex replied to your support ticket #4219.',
      actionId: 'open',
      actionLabel: 'View ticket'
    },
    {
      title: 'Performance alert',
      body: 'API response time exceeded 2s threshold in us-east-1.',
      actionId: 'view',
      actionLabel: 'View metrics'
    },
    {
      title: 'Weekly report ready',
      body: 'Your weekly team analytics report for Jun 29 — Jul 5 is ready.',
      actionId: 'view',
      actionLabel: 'View report'
    }
  ];

  const rows = notificationTemplates.map((t, i) => ({
    title: t.title,
    body: t.body,
    user_id: userId,
    status: i < 6 ? ('unread' as const) : ('read' as const),
    actions: [
      { id: t.actionId, label: t.actionLabel, type: 'redirect' as const, style: 'primary' as const }
    ]
  }));

  await db.insert(notifications).values(rows);
  console.log(`Seeded ${rows.length} notifications for user ${userId}`);
}

async function seedMasterdata() {
  // Clear attendance schedule tables first: they hold FKs to shifts/locations.
  // Corrections reference attendance rows, so delete them before employee_shifts.
  await db.delete(attendanceCorrections);
  await db.delete(employeeShifts);
  await db.delete(dayOffs);
  await db.delete(dateOverrides);
  await db.delete(scheduleAssignments);
  await db.delete(shiftWeekdayRules);
  await db.delete(taskRequirements);
  await db.delete(employeeSkills);
  await db.delete(ticketLegs);
  await db.delete(tickets);
  await db.delete(employees);
  await db.delete(locations);
  await db.delete(shifts);
  await db.delete(departments);
  await db.delete(designations);

  const locationData = [
    {
      name: 'Head Office',
      latitude: -6.2088,
      longitude: 106.8456,
      radius: 50,
      selfie_required: true,
      description: 'Main office Jakarta'
    }
  ] satisfies NewLocation[];

  await db.insert(locations).values(locationData);
  console.log(`Seeded ${locationData.length} locations`);

  const shiftData = [
    {
      name: 'Morning Shift',
      start_time: '08:00',
      end_time: '17:00',
      type: 'fixed' as const,
      status: 'active' as const
    },
    {
      name: 'Afternoon Shift',
      start_time: '13:00',
      end_time: '22:00',
      type: 'fixed' as const,
      status: 'active' as const
    },
    {
      name: 'Night Shift',
      start_time: '22:00',
      end_time: '06:00',
      type: 'fixed' as const,
      status: 'active' as const
    }
  ] satisfies NewShift[];

  await db.insert(shifts).values(shiftData);
  console.log(`Seeded ${shiftData.length} shifts`);

  const departmentData = [
    { name: 'Engineering', code: 'ENG', description: 'Network Engineering & NOC' },
    { name: 'Operations', code: 'OPS', description: 'Field Operations & Installation' },
    { name: 'Sales & Marketing', code: 'SALES', description: 'Sales & Marketing Team' },
    { name: 'Customer Service', code: 'CS', description: 'Customer Support & Helpdesk' },
    { name: 'Finance & Billing', code: 'FIN', description: 'Finance & Billing Department' },
    { name: 'HR & Administration', code: 'HR', description: 'Human Resources & Admin' }
  ] satisfies NewDepartment[];

  await db.insert(departments).values(departmentData);
  console.log(`Seeded ${departmentData.length} departments`);

  const engId = (
    await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.code, 'ENG'))
      .limit(1)
  )[0]?.id;
  const opsId = (
    await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.code, 'OPS'))
      .limit(1)
  )[0]?.id;
  const salesId = (
    await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.code, 'SALES'))
      .limit(1)
  )[0]?.id;
  const csId = (
    await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.code, 'CS'))
      .limit(1)
  )[0]?.id;
  const finId = (
    await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.code, 'FIN'))
      .limit(1)
  )[0]?.id;
  const hrId = (
    await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.code, 'HR'))
      .limit(1)
  )[0]?.id;

  const designationData = [
    { name: 'NOC Engineer', code: 'NOC_ENGR', department_id: engId, base_salary: 5000000 },
    { name: 'Network Engineer', code: 'NET_ENGR', department_id: engId, base_salary: 7000000 },
    {
      name: 'Senior Network Engineer',
      code: 'SR_NET',
      department_id: engId,
      base_salary: 10000000
    },
    { name: 'Field Technician', code: 'FLD_TECH', department_id: opsId, base_salary: 4500000 },
    {
      name: 'Field Supervisor',
      code: 'FLD_SUP',
      department_id: opsId,
      base_salary: 7000000
    },
    {
      name: 'Senior Field Technician',
      code: 'SR_TECH',
      department_id: opsId,
      base_salary: 6000000
    },
    {
      name: 'Installation Specialist',
      code: 'INSTALL',
      department_id: opsId,
      base_salary: 4500000
    },
    { name: 'Sales Agent', code: 'SALES_AGT', department_id: salesId, base_salary: 4000000 },
    { name: 'Sales Supervisor', code: 'SALES_SUP', department_id: salesId, base_salary: 7000000 },
    { name: 'Customer Service Rep', code: 'CS_REP', department_id: csId, base_salary: 4000000 },
    { name: 'Support Engineer', code: 'SUP_ENGR', department_id: csId, base_salary: 5000000 },
    { name: 'Billing Specialist', code: 'BILLING', department_id: finId, base_salary: 4500000 },
    { name: 'Finance Officer', code: 'FIN_OFF', department_id: finId, base_salary: 6000000 },
    { name: 'HR Specialist', code: 'HR_SPEC', department_id: hrId, base_salary: 5000000 }
  ] satisfies NewDesignation[];

  await db.insert(designations).values(designationData);
  console.log(`Seeded ${designationData.length} designations`);
}

async function seedDemoUsers() {
  const demoAccounts = [
    {
      email: 'admin@example.com',
      name: 'Demo Admin',
      password: 'Password123!',
      role: 'admin' as const
    },
    { email: 'hr@example.com', name: 'Demo HR', password: 'Password123!', role: 'hr' as const },
    {
      email: 'employee@example.com',
      name: 'Demo Employee',
      password: 'Password123!',
      role: 'employee' as const
    },
    {
      email: 'technician@example.com',
      name: 'Demo Technician',
      password: 'Password123!',
      role: 'technician' as const
    },
    {
      email: 'spv@example.com',
      name: 'Demo Supervisor',
      password: 'Password123!',
      role: 'technician' as const
    }
  ];

  await Promise.all(
    demoAccounts.map(async (demo) => {
      try {
        const created = await (auth.api as any).createUser({
          body: { email: demo.email, name: demo.name, password: demo.password, role: demo.role }
        });
        console.log(`Seeded ${demo.role} user ${demo.email}`);
        return created.id as string;
      } catch (err: any) {
        const msg = (err?.message ?? '').toLowerCase();
        if (msg.includes('already exists')) {
          console.log(`${demo.role} user ${demo.email} already exists (skipped)`);
          const [existing] = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, demo.email))
            .limit(1);
          return existing?.id;
        }
        throw err;
      }
    })
  );
}

async function seedEmployees() {
  const employeeData = [
    {
      employee_code: 'EMP001',
      full_name: 'Demo Admin',
      email: 'admin@example.com',
      department_code: 'ENG',
      designation_code: 'SR_NET'
    },
    {
      employee_code: 'EMP002',
      full_name: 'Demo HR',
      email: 'hr@example.com',
      department_code: 'HR',
      designation_code: 'HR_SPEC'
    },
    {
      employee_code: 'EMP003',
      full_name: 'Demo Employee',
      email: 'employee@example.com',
      department_code: 'SALES',
      designation_code: 'SALES_AGT'
    },
    {
      employee_code: 'EMP004',
      full_name: 'Demo Technician',
      email: 'technician@example.com',
      department_code: 'OPS',
      designation_code: 'FLD_TECH'
    },
    {
      employee_code: 'EMP005',
      full_name: 'Demo Supervisor',
      email: 'spv@example.com',
      department_code: 'OPS',
      designation_code: 'FLD_SUP'
    }
  ];

  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const userMap = new Map(users.map((u) => [u.email, u.id]));

  const depts = await db.select({ id: departments.id, code: departments.code }).from(departments);
  const deptMap = new Map(depts.map((d) => [d.code, d.id]));

  const desigs = await db
    .select({ id: designations.id, code: designations.code })
    .from(designations);
  const desigMap = new Map(desigs.map((d) => [d.code, d.id]));

  const locs = await db.select({ id: locations.id, name: locations.name }).from(locations);
  const locMap = new Map(locs.map((l) => [l.name, l.id]));

  const employeeRecords = employeeData.map((emp) => {
    const userId = userMap.get(emp.email);
    if (!userId) throw new Error(`User not found for ${emp.email}`);
    return {
      id: userId,
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      email: emp.email,
      birth_date: '1990-01-01',
      department_id: deptMap.get(emp.department_code) ?? 0,
      designation_id: desigMap.get(emp.designation_code) ?? 0,
      location_id: locMap.get('Head Office') ?? null,
      join_date: '2024-01-01'
    };
  });

  await db.delete(employees);
  await db.insert(employees).values(employeeRecords);
  console.log(`Seeded ${employeeRecords.length} employee records`);
}

async function seedPayroll() {
  await db.delete(payslips);
  await db.delete(employeeSalaryComponents);
  await db.delete(employeeSalaryAssignments);
  await db.delete(employeeTaxProfiles);
  await db.delete(employeeBenefitEnrollments);
  await db.delete(employeeBankAccounts);
  await db.delete(employeeEmploymentEvents);
  await db.delete(employeeDocuments);
  await db.delete(payrollRecords);
  await db.delete(payrollPeriods);
  await db.delete(salaryComponents);
  await db.delete(taxSettings);
  await db.delete(companyPayrollSettings);
  await db.delete(employeeBpjsEnrollments);
  await db.delete(auditLog);

  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const byEmail = new Map(users.map((row) => [row.email, row.id]));
  const adminId = byEmail.get('admin@example.com');
  if (!adminId) throw new Error('Admin user not found for payroll seed');

  const componentRows = await db
    .insert(salaryComponents)
    .values([
      { code: 'DEMO-TRANSPORT', name: 'Demo Transport Allowance', type: 'allowance' },
      { code: 'DEMO-MEAL', name: 'Demo Meal Allowance', type: 'allowance' },
      { code: 'DEMO-LOAN', name: 'Demo Loan Deduction', type: 'deduction' }
    ])
    .returning({ id: salaryComponents.id, code: salaryComponents.code });
  const components = new Map(componentRows.map((row) => [row.code, row.id]));

  const [taxSetting] = await db
    .insert(taxSettings)
    .values({
      code: 'DEMO-NONE',
      name: 'Demo tax-free setting',
      rates: { method: 'none', ptkp: '0' },
      effective_from: '2026-01-01'
    })
    .returning({ id: taxSettings.id });
  if (!taxSetting) throw new Error('Failed to seed demo tax setting');

  const existingSettings = await db.select().from(companyPayrollSettings).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(companyPayrollSettings).values({
      company_npwp: '000000000000000',
      cut_off_day: 7,
      pph21_enabled: true,
      pph21_method: 'gross',
      jkk_enabled: true,
      jkm_enabled: true,
      jht_enabled: true,
      jp_enabled: true,
      bpjs_kesehatan_enabled: true,
      jkk_risk_category: 'low',
      jkm_company_rate: '0.3',
      jht_company_rate: '3.7',
      jht_employee_rate: '2',
      jp_company_rate: '2',
      jp_employee_rate: '1',
      kesehatan_company_rate: '4',
      kesehatan_employee_rate: '1',
      potongan_izin_jam_default: '0',
      potongan_shortfall_default: '0'
    });
  }

  const employeeRows = await db
    .select({
      id: employees.id,
      email: employees.email,
      department_id: employees.department_id,
      designation_id: employees.designation_id
    })
    .from(employees);
  const salaryByEmail: Record<string, { type: 'monthly' | 'daily' | 'hourly'; amount: string }> = {
    'admin@example.com': { type: 'monthly', amount: '10000000.00' },
    'hr@example.com': { type: 'monthly', amount: '5000000.00' },
    'employee@example.com': { type: 'daily', amount: '250000.00' },
    'technician@example.com': { type: 'hourly', amount: '50000.00' },
    'spv@example.com': { type: 'monthly', amount: '7000000.00' }
  };

  for (const employee of employeeRows) {
    const salary = salaryByEmail[employee.email];
    if (!salary) continue;
    const [assignment] = await db
      .insert(employeeSalaryAssignments)
      .values({
        employee_id: employee.id,
        department_id: employee.department_id,
        designation_id: employee.designation_id,
        salary_type: salary.type,
        amount: salary.amount,
        effective_from: '2026-01-01',
        created_by: adminId
      })
      .returning({ id: employeeSalaryAssignments.id });
    if (!assignment) throw new Error(`Failed to seed salary assignment for ${employee.email}`);
    await db.insert(employeeSalaryComponents).values([
      {
        assignment_id: assignment.id,
        salary_component_id: components.get('DEMO-TRANSPORT')!,
        amount: '250000.00',
        effective_from: '2026-01-01'
      },
      {
        assignment_id: assignment.id,
        salary_component_id: components.get('DEMO-MEAL')!,
        amount: '150000.00',
        effective_from: '2026-01-01'
      },
      {
        assignment_id: assignment.id,
        salary_component_id: components.get('DEMO-LOAN')!,
        amount: '50000.00',
        effective_from: '2026-01-01'
      }
    ]);
    await db.insert(employeeTaxProfiles).values({
      employee_id: employee.id,
      tax_setting_id: taxSetting.id,
      tax_identifier: 'TAX-DEMO-001',
      filing_status: 'single',
      effective_from: '2026-01-01'
    });
    await db.insert(employeeBenefitEnrollments).values({
      employee_id: employee.id,
      benefit_code: 'BPJS-DEMO',
      benefit_name: 'Demo BPJS enrollment',
      amount: '100000.00',
      effective_from: '2026-01-01'
    });
    await db.insert(employeeBankAccounts).values({
      employee_id: employee.id,
      bank_name: 'Demo Bank',
      account_name: employee.email,
      account_number: '000000000001',
      is_primary: true,
      effective_from: '2026-01-01'
    });
    await db.insert(employeeBpjsEnrollments).values([
      {
        employee_id: employee.id,
        program: 'jht',
        membership_number: 'B-0001',
        registered_wage: salary.amount,
        effective_from: '2026-01-01'
      },
      {
        employee_id: employee.id,
        program: 'jp',
        membership_number: 'P-0001',
        registered_wage: salary.amount,
        effective_from: '2026-01-01'
      },
      {
        employee_id: employee.id,
        program: 'kesehatan',
        membership_number: 'K-0001',
        registered_wage: salary.amount,
        effective_from: '2026-01-01'
      }
    ]);
  }

  await db.insert(payrollPeriods).values({
    name: 'Task 7 Demo Payroll',
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    payment_date: '2026-09-05',
    status: 'draft',
    created_by: adminId
  });
  console.log(`Seeded payroll profile data for ${employeeRows.length} demo employees`);
}

async function seedCustomers() {
  const adminUsers = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, 'admin@example.com'));
  const adminUser = adminUsers[0];
  if (!adminUser) throw new Error('Admin user not found for created_by reference');

  const customersToCreate = Array.from({ length: 10 }, (_, i) => {
    const hasCoordinates = i !== 1;
    return {
      email: `customer${i + 1}@example.com`,
      name: faker.person.fullName(),
      password: 'Password123!',
      role: 'customer' as const,
      customer_code: `CUST-${String(i + 1).padStart(4, '0')}`,
      phone: faker.phone.number({ style: 'international' }),
      address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
      latitude: hasCoordinates ? faker.location.latitude({ min: -6.5, max: -6.0 }) : 0,
      longitude: hasCoordinates ? faker.location.longitude({ min: 106.5, max: 107.0 }) : 0,
      id_card_number: `3201${String(i + 1).padStart(12, '0')}`,
      service_data: JSON.stringify({
        pppoe_username: `cust${i + 1}`,
        pppoe_password: faker.internet.password()
      }),
      billing_address: `${faker.location.streetAddress()}, ${faker.location.city()}`
    };
  });

  const customerRecords: NewCustomer[] = [];

  for (const c of customersToCreate) {
    try {
      await (auth.api as any).createUser({
        body: { email: c.email, name: c.name, password: c.password, role: c.role }
      });
    } catch (err: any) {
      const msg = (err?.message ?? '').toLowerCase();
      if (!msg.includes('already exists')) throw err;
    }
    const [userRow] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, c.email))
      .limit(1);
    if (userRow) {
      customerRecords.push({
        id: userRow.id,
        customer_code: c.customer_code,
        full_name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
        id_card_number: c.id_card_number,
        id_card_photo: '',
        service_data: c.service_data,
        billing_address: c.billing_address,
        notes: '',
        status: 'active',
        created_by: adminUser.id
      });
    }
  }

  if (customerRecords.length > 0) {
    await db.delete(customers);
    await db.insert(customers).values(customerRecords);
  }
  console.log(`Seeded ${customerRecords.length} customer records`);
}

async function seedTickets() {
  await db.delete(taskRequirements);
  await db.delete(employeeSkills);
  await db.delete(ticketLegs);
  await db.delete(tickets);

  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const byEmail = new Map(users.map((u) => [u.email, u.id]));
  const adminId = byEmail.get('admin@example.com');
  const techId = byEmail.get('technician@example.com');
  const empId = byEmail.get('employee@example.com');
  if (!adminId || !techId || !empId) throw new Error('Demo users not found for tickets seed');

  const depts = await db.select({ id: departments.id, code: departments.code }).from(departments);
  const deptMap = new Map(depts.map((d) => [d.code, d.id]));
  const desigs = await db
    .select({ id: designations.id, code: designations.code })
    .from(designations);
  const desigMap = new Map(desigs.map((d) => [d.code, d.id]));
  const locs = await db.select({ id: locations.id, name: locations.name }).from(locations);
  const locMap = new Map(locs.map((l) => [l.name, l.id]));
  const custs = await db
    .select({ id: customers.id, full_name: customers.full_name, latitude: customers.latitude })
    .from(customers)
    .orderBy(customers.customer_code);
  const custWithCoords = custs.find((c) => c.latitude !== 0)?.id;
  const custNoCoords = custs.find((c) => c.latitude === 0)?.id;

  await db.insert(employeeSkills).values([
    { user_id: techId, skill: 'Fiber Optic' },
    { user_id: techId, skill: 'Networking' },
    { user_id: techId, skill: 'Customer Care' },
    { user_id: empId, skill: 'Customer Care' }
  ]);

  const due = (days: number) => new Date(Date.now() + days * 86400000);

  const [t1, t2, t3, t4, t5] = await db
    .insert(tickets)
    .values([
      {
        title: 'Fix network room 201',
        description: 'Switch port 12 is down — replace the faulty switch and verify link.',
        task_type: 'maintenance',
        status: 'assigned',
        priority: 'high',
        location_id: locMap.get('Head Office') ?? null,
        due_at: due(1),
        estimated_minutes: 120,
        assigned_to: techId,
        created_by: adminId
      },
      {
        title: 'Install Fiber Router — Jakarta',
        description: 'New customer install at Head Office. Two-hour window.',
        task_type: 'installation',
        status: 'open',
        priority: 'high',
        customer_id: custWithCoords,
        asset_name: 'Fiber Router',
        due_at: due(2),
        estimated_minutes: 120,
        created_by: adminId
      },
      {
        title: 'Network audit — Head Office',
        description: 'Monthly switch and cabling audit across the main floor.',
        task_type: 'inspection',
        status: 'open',
        priority: 'medium',
        location_id: locMap.get('Head Office') ?? null,
        due_at: due(3),
        estimated_minutes: 240,
        created_by: adminId
      },
      {
        title: 'Fiber cable repair — corridor 3',
        description: 'Customer complaint: weak signal. Trace and repair the drop cable.',
        task_type: 'maintenance',
        status: 'open',
        priority: 'medium',
        due_at: due(1),
        estimated_minutes: 90,
        created_by: adminId
      },
      {
        title: 'Customer visit follow-up',
        description: 'Follow up on the renewal quote sent to customer.',
        task_type: 'sales',
        status: 'open',
        priority: 'low',
        customer_id: custNoCoords,
        due_at: due(4),
        estimated_minutes: 60,
        created_by: adminId
      }
    ])
    .returning();

  await db
    .insert(ticketLegs)
    .values(
      [t1, t2, t3, t4, t5].flatMap((t) => [
        { ticket_id: t.id, leg_number: 1, name: t.title, status: 'open' as const }
      ])
    );

  await db.insert(taskRequirements).values([
    { task_id: t2.id, designation_id: desigMap.get('FLD_TECH'), skill: 'Fiber Optic' },
    { task_id: t3.id, department_id: deptMap.get('OPS'), skill: 'Networking' },
    { task_id: t4.id, designation_id: desigMap.get('FLD_TECH') },
    { task_id: t5.id, department_id: deptMap.get('OPS'), skill: 'Customer Care' }
  ]);

  console.log('Seeded 5 tickets, 4 ticket requirements, 3 employee skills');
}

async function seedAchievementsDemo() {
  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const byEmail = new Map(users.map((u) => [u.email, u.id]));
  const techId = byEmail.get('technician@example.com');
  const adminId = byEmail.get('admin@example.com');
  if (!techId || !adminId) throw new Error('Demo users not found for achievements seed');

  const shiftsRows = await db.select({ id: shifts.id, name: shifts.name }).from(shifts);
  const morning = shiftsRows.find((s) => s.name === 'Morning Shift');
  if (!morning) throw new Error('Morning Shift not found for achievements seed');

  // --- Attendance history: 35 consecutive present days ending today (business TZ) ---
  const businessDate = businessDateInTimeZone(new Date());
  const today = new Date(`${businessDate}T00:00:00`);
  const monthPrefix = businessDate.slice(0, 7);

  // Pick 5 distinct early-check-in dates within this month (and within the streak window)
  const earlyDates = new Set<string>();
  let cursor = new Date(today);
  while (earlyDates.size < 5 && cursor >= new Date(`${businessDate.slice(0, 7)}-01T00:00:00`)) {
    earlyDates.add(businessDateInTimeZone(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  // If month is younger than 5 days (e.g. the 1st–4th), backfill from previous month:
  let backfill = 0;
  while (earlyDates.size < 5) {
    const d = new Date(today);
    d.setDate(d.getDate() - 5 - backfill);
    earlyDates.add(businessDateInTimeZone(d));
    backfill++;
  }

  const attendanceRows: Array<{
    user_id: string;
    shift_id: number;
    date: string;
    check_in_time: string;
    check_out_time: string;
    check_in_timestamp: Date;
    check_out_timestamp: Date;
    attendance_status: string;
  }> = [];

  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = businessDateInTimeZone(d);
    const isEarly = earlyDates.has(dateStr);
    attendanceRows.push({
      user_id: techId,
      shift_id: morning.id,
      date: dateStr,
      check_in_time: isEarly ? '06:45' : '08:05',
      check_out_time: '17:30',
      check_in_timestamp: new Date(`${dateStr}T${isEarly ? '06:45' : '08:05'}:00`),
      check_out_timestamp: new Date(`${dateStr}T17:30:00`),
      attendance_status: 'present'
    });
  }

  await db.insert(employeeShifts).values(attendanceRows);
  console.log(
    `Seeded ${attendanceRows.length} attendance days for achievements (5 early check-ins in ${monthPrefix})`
  );

  // --- Completed tickets: 10 inspection tickets (OLT Master) ---
  const weekStart = new Date(today);
  while (weekStart.getDay() !== 1) weekStart.setDate(weekStart.getDate() - 1); // back to Monday

  const mkDate = (d: Date, hour: number, minute: number) => {
    const dateStr = businessDateInTimeZone(d);
    return new Date(
      `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
    );
  };

  // 4 tickets completed this week (business Monday → today)
  const weekTickets = [0, 1, 2, 3].map((i) => {
    const completed = new Date(weekStart);
    completed.setDate(completed.getDate() + Math.min(i, 4)); // Mon..Fri-ish, clamped to today window
    if (completed > today) completed.setTime(today.getTime());
    const completedAt = mkDate(completed, 10 + i, 0);
    const takenAt = new Date(completedAt);
    takenAt.setMinutes(takenAt.getMinutes() - 120); // 2h elapsed → NOT fast finisher
    return { completedAt, takenAt, title: `Weekly OLT inspection ${i + 1}` };
  });

  // 6 tickets completed earlier this month (before the business Monday)
  const earlierTickets = [0, 1, 2, 3, 4, 5].map((i) => {
    const completed = new Date(weekStart);
    completed.setDate(completed.getDate() - (i + 1) * 3); // spread over prior days
    const completedAt = mkDate(completed, 9 + (i % 6), 30);
    const takenAt = new Date(completedAt);
    takenAt.setMinutes(takenAt.getMinutes() - 120);
    return { completedAt, takenAt, title: `OLT inspection follow-up ${i + 1}` };
  });

  await db.insert(tickets).values(
    [...weekTickets, ...earlierTickets].map(({ completedAt, takenAt, title }) => ({
      title,
      description: 'Seeded completed ticket for achievements demo.',
      task_type: 'inspection' as const,
      status: 'completed' as const,
      priority: 'medium' as const,
      assigned_to: techId,
      taken_by: techId,
      taken_at: takenAt,
      completed_at: completedAt,
      created_by: adminId
    }))
  );
  console.log(`Seeded 10 completed inspection tickets for achievements (4 this week, 6 earlier)`);
}

async function seedRoleGroups() {
  const adminId = 'zzzrg-admin';
  const techId = 'zzzrg-technician';
  const spvId = 'zzzrg-spv';
  const hrId = 'zzzrg-hr';
  const employeeId = 'zzzrg-employee';

  const coreModules = {
    overview: { view: true },
    my_work: { view: true },
    attendance: { view: true },
    leave: { view: true },
    profile: { view: true }
  };

  await db.delete(userRoleGroups);
  await db.delete(roleGroups);

  await db
    .insert(roleGroups)
    .values([
      {
        id: adminId,
        name: 'Administrator',
        description: 'Full system access',
        permissions: {},
        is_admin: true
      },
      {
        id: hrId,
        name: 'HR',
        description: 'Human resources access',
        permissions: {
          ...coreModules,
          attendance: { view: true, edit: true },
          employees: { view: true, add: true, edit: true, delete: true },
          departments: { view: true, add: true, edit: true },
          designations: { view: true, add: true, edit: true },
          users: { view: true },
          audit_log: { view: true },
          attendance_admin: { view: true },
          settings: { view: true, edit: true },
          payroll: {
            view: true,
            add: true,
            edit: true,
            delete: true,
            approve: true,
            pay: true,
            reports: true
          }
        },
        is_admin: false
      },
      {
        id: employeeId,
        name: 'Employee',
        description: 'Standard employee access',
        permissions: {
          ...coreModules,
          jobs: { view: true },
          tickets: { view: true },
          notifications: { view: true },
          payroll: { view: true }
        },
        is_admin: false
      },
      {
        id: techId,
        name: 'Technician',
        description: 'Field technician access',
        permissions: {
          ...coreModules,
          jobs: { view: true },
          tickets: { view: true, add: true, edit: true },
          customers: { view: true },
          notifications: { view: true },
          schedule: { view: true },
          achievements: { view: true },
          payroll: { view: true }
        },
        is_admin: false
      },
      {
        id: spvId,
        name: 'SPV',
        description: 'Supervisor — field ops with review & leave approval',
        permissions: {
          ...coreModules,
          jobs: { view: true },
          tickets: { view: true, add: true, edit: true },
          customers: { view: true },
          notifications: { view: true },
          schedule: { view: true },
          achievements: { view: true },
          payroll: { view: true },
          leave: { view: true, edit: true },
          spv_review: { view: true, edit: true }
        },
        is_admin: false
      }
    ])
    .onConflictDoNothing();

  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const byEmail = new Map(users.map((u) => [u.email, u.id]));

  const assignments = [
    [byEmail.get('admin@example.com'), adminId, 'Administrator', 'admin@example.com'],
    [byEmail.get('hr@example.com'), hrId, 'HR', 'hr@example.com'],
    [byEmail.get('employee@example.com'), employeeId, 'Employee', 'employee@example.com'],
    [byEmail.get('technician@example.com'), techId, 'Technician', 'technician@example.com'],
    [byEmail.get('spv@example.com'), spvId, 'SPV', 'spv@example.com']
  ] as const;

  for (const [userId, roleGroupId, name, email] of assignments) {
    if (userId) {
      await db
        .insert(userRoleGroups)
        .values({ user_id: userId, role_group_id: roleGroupId })
        .onConflictDoNothing();
      console.log(`Assigned ${name} role to ${email}`);
    }
  }

  console.log('Seeded role groups');
}

async function seedAttendanceSchedules() {
  await db.delete(leaveTypeConfigs);
  await db.insert(leaveTypeConfigs).values([{ leave_type: 'sick', attachment_required: true }]);
  console.log('Seeded leave type config (sick requires attachment)');

  await db.delete(attendanceCorrections);
  await db.delete(dayOffs);
  await db.delete(dateOverrides);
  await db.delete(scheduleAssignments);
  await db.delete(shiftWeekdayRules);

  const shiftsRows = await db.select({ id: shifts.id, name: shifts.name }).from(shifts);
  const morning = shiftsRows.find((s) => s.name === 'Morning Shift');
  if (!morning) throw new Error('Morning Shift not found for schedule seed');

  const weekdayRules = [1, 2, 3, 4, 5].map((day) => ({
    shift_id: morning.id,
    day_of_week: day,
    is_working_day: true,
    start_time: '08:00',
    end_time: '17:00',
    late_tolerance_minutes: 10,
    absence_cutoff_minutes: 120
  }));
  await db.insert(shiftWeekdayRules).values(weekdayRules);
  console.log(`Seeded ${weekdayRules.length} weekday rules for Morning Shift`);

  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const byEmail = new Map(users.map((u) => [u.email, u.id]));
  const empId = byEmail.get('employee@example.com');
  if (empId) {
    await db.insert(scheduleAssignments).values({
      user_id: empId,
      shift_id: morning.id,
      effective_from: '2026-01-01',
      effective_to: null,
      created_by: 'seed'
    });
    console.log(`Assigned Morning Shift to employee@example.com`);

    await db.insert(dayOffs).values({
      user_id: empId,
      date: '2026-08-17',
      reason: 'Company day off example',
      created_by: 'seed'
    });
    console.log(`Seeded day off example for employee@example.com`);
  }

  await db
    .update(locations)
    .set({
      gps_validation_enabled: true,
      selfie_required: true,
      max_accuracy_meters: 50,
      max_stale_ms: 30000
    })
    .where(eq(locations.name, 'Head Office'));
  console.log('Seeded policy override for Head Office');
}

export async function seedPerformance() {
  await db.delete(performanceReports);

  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const byEmail = new Map(users.map((row) => [row.email, row.id]));
  const staffEmails = ['employee@example.com', 'technician@example.com', 'spv@example.com'];
  const now = new Date();
  const dates = [
    new Date(now.getFullYear(), now.getMonth() - 2, 11),
    new Date(now.getFullYear(), now.getMonth() - 1, 11),
    new Date(now.getFullYear(), now.getMonth(), 11)
  ];

  const rows: Array<{ user_id: string; date: string; score: string }> = [];
  for (const email of staffEmails) {
    const id = byEmail.get(email);
    if (!id) continue;
    const scores = email.includes('technician') ? ['91.6', '94'] : ['88', '90'];
    dates.slice(-scores.length).forEach((d, i) => {
      rows.push({
        user_id: id,
        date: d.toISOString().slice(0, 10),
        score: scores[i]
      });
    });
  }
  if (rows.length > 0) {
    await db.insert(performanceReports).values(rows);
    console.log(`Seeded ${rows.length} performance reports`);
  }
}

export async function seedDatabase() {
  faker.seed(42);
  await seedMasterdata();
  await seedDemoUsers();
  await seedEmployees();
  await seedPayroll();
  await seedCustomers();
  await seedTickets();
  if (process.env.SEED_DEMO_ACHIEVEMENTS === '1') {
    await seedAchievementsDemo();
  }
  await seedRoleGroups();
  await seedAttendanceSchedules();
  await seedPerformance();
  const userId = await seedUsers();
  await seedNotifications(userId);
  console.log('Seed complete');
  await dbClient?.end();
}

if (import.meta.main) {
  seedDatabase()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .then(() => process.exit(0));
}
