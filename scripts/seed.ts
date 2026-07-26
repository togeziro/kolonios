import { faker } from '@faker-js/faker';
import { db } from '../src/lib/db';
import { auth } from '../src/lib/auth/auth.server';
import { products, notifications, employees, departments, designations, locations, shifts } from '../src/lib/db/schema';
import { user } from '../src/lib/db/auth-schema';
import { type NewEmployee, type NewDepartment, type NewDesignation, type NewLocation, type NewShift } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const PRODUCT_CATEGORIES = [
  'Electronics',
  'Furniture',
  'Clothing',
  'Toys',
  'Groceries',
  'Books',
  'Jewelry',
  'Beauty Products'
] as const;

const ROLES = ['admin', 'hr', 'employee', 'technician'] as const;



async function seedProducts(count = 20) {
  const rows = Array.from({ length: count }, (_, i) => ({
    photo_url: `https://api.slingacademy.com/public/sample-products/${i + 1}.png`,
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: faker.commerce.price({ min: 5, max: 500, dec: 2 }),
    category: faker.helpers.arrayElement(PRODUCT_CATEGORIES)
  }));

  await db.delete(products);
  await db.insert(products).values(rows);
  console.log(`Seeded ${rows.length} products`);
}


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
      const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, demo.email)).limit(1);
      return existing?.id;
    }
    throw err;
  }
}

async function seedNotifications(userId: string) {
  await db.delete(notifications);

  const notificationTemplates = [
    { title: 'New team member joined', body: 'Sarah Connor has joined the Engineering workspace.', actionId: 'view', actionLabel: 'View workspace' },
    { title: 'New product added', body: 'A new product "Dashboard Pro" has been added to the catalog.', actionId: 'view-product', actionLabel: 'View products' },
    { title: 'Billing cycle updated', body: 'Your Pro plan has been renewed. Next invoice on April 24, 2026.', actionId: 'billing', actionLabel: 'View billing' },
    { title: 'Task assigned to you', body: 'You have been assigned "Update dashboard analytics".', actionId: 'open', actionLabel: 'View details' },
    { title: 'Deploy successful', body: 'Production v2.4.1 deployed successfully at 14:32 UTC.', actionId: 'view', actionLabel: 'View deployment' },
    { title: 'New comment on ticket', body: 'Alex replied to your support ticket #4219.', actionId: 'open', actionLabel: 'View ticket' },
    { title: 'Performance alert', body: 'API response time exceeded 2s threshold in us-east-1.', actionId: 'view', actionLabel: 'View metrics' },
    { title: 'Weekly report ready', body: 'Your weekly team analytics report for Jun 29 — Jul 5 is ready.', actionId: 'view', actionLabel: 'View report' }
  ];

  const rows = notificationTemplates.map((t, i) => ({
    title: t.title,
    body: t.body,
    user_id: userId,
    status: i < 6 ? 'unread' as const : 'read' as const,
    actions: [{ id: t.actionId, label: t.actionLabel, type: 'redirect' as const, style: 'primary' as const }]
  }));

  await db.insert(notifications).values(rows);
  console.log(`Seeded ${rows.length} notifications for user ${userId}`);
}

async function seedMasterdata() {
  await db.delete(locations);
  await db.delete(shifts);
  await db.delete(departments);
  await db.delete(designations);

  const locationData = [
    { name: 'Head Office', latitude: -6.2088, longitude: 106.8456, radius: 50, description: 'Main office Jakarta' },
    { name: 'Branch Office 1', latitude: -6.5000, longitude: 106.8000, radius: 50, description: 'Bandung Branch' }
  ] satisfies NewLocation[];

  await db.insert(locations).values(locationData);
  console.log(`Seeded ${locationData.length} locations`);

  const shiftData = [
    { name: 'Morning Shift', start_time: '08:00', end_time: '17:00', type: 'fixed' as const, status: 'active' as const },
    { name: 'Afternoon Shift', start_time: '13:00', end_time: '22:00', type: 'fixed' as const, status: 'active' as const },
    { name: 'Night Shift', start_time: '22:00', end_time: '06:00', type: 'fixed' as const, status: 'active' as const }
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

  const engId = (await db.select({ id: departments.id }).from(departments).where(eq(departments.code, 'ENG')).limit(1))[0]?.id;
  const opsId = (await db.select({ id: departments.id }).from(departments).where(eq(departments.code, 'OPS')).limit(1))[0]?.id;
  const salesId = (await db.select({ id: departments.id }).from(departments).where(eq(departments.code, 'SALES')).limit(1))[0]?.id;
  const csId = (await db.select({ id: departments.id }).from(departments).where(eq(departments.code, 'CS')).limit(1))[0]?.id;
  const finId = (await db.select({ id: departments.id }).from(departments).where(eq(departments.code, 'FIN')).limit(1))[0]?.id;
  const hrId = (await db.select({ id: departments.id }).from(departments).where(eq(departments.code, 'HR')).limit(1))[0]?.id;

  const designationData = [
    { name: 'NOC Engineer', code: 'NOC_ENGR', department_id: engId, base_salary: 5000000 },
    { name: 'Network Engineer', code: 'NET_ENGR', department_id: engId, base_salary: 7000000 },
    { name: 'Senior Network Engineer', code: 'SR_NET', department_id: engId, base_salary: 10000000 },
    { name: 'Field Technician', code: 'FLD_TECH', department_id: opsId, base_salary: 4500000 },
    { name: 'Senior Field Technician', code: 'SR_TECH', department_id: opsId, base_salary: 6000000 },
    { name: 'Installation Specialist', code: 'INSTALL', department_id: opsId, base_salary: 4500000 },
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
    { email: 'admin@example.com', name: 'Demo Admin', password: 'Password123!', role: 'admin' as const },
    { email: 'hr@example.com', name: 'Demo HR', password: 'Password123!', role: 'hr' as const },
    { email: 'employee@example.com', name: 'Demo Employee', password: 'Password123!', role: 'employee' as const },
    { email: 'technician@example.com', name: 'Demo Technician', password: 'Password123!', role: 'technician' as const }
  ];

  await Promise.all(demoAccounts.map(async (demo) => {
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
        const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, demo.email)).limit(1);
        return existing?.id;
      }
      throw err;
    }
  }));
}

async function seedEmployees() {
  const employeeData = [
    { user_id: 'placeholder', employee_code: 'EMP001', full_name: 'Demo Admin', email: 'admin@example.com', department_id: 1, designation_id: 1 },
    { user_id: 'placeholder', employee_code: 'EMP002', full_name: 'Demo HR', email: 'hr@example.com', department_id: 6, designation_id: 13 },
    { user_id: 'placeholder', employee_code: 'EMP003', full_name: 'Demo Employee', email: 'employee@example.com', department_id: 3, designation_id: 7 },
    { user_id: 'placeholder', employee_code: 'EMP004', full_name: 'Demo Technician', email: 'technician@example.com', department_id: 2, designation_id: 4 }
  ];

  const users = await db.select({ id: user.id, email: user.email }).from(user);
  const userMap = new Map(users.map(u => [u.email, u.id]));

  const employeeRecords = employeeData.map((emp, i) => ({
    ...emp,
    user_id: userMap.get(emp.email) || `auto-${i}`
  }));

  await db.delete(employees);
  await db.insert(employees).values(employeeRecords);
  console.log(`Seeded ${employeeRecords.length} employee records`);
}

async function main() {
  faker.seed(42);
  await seedProducts();
  await seedMasterdata();
  await seedDemoUsers();
  await seedEmployees();
  const userId = await seedUsers();
  await seedNotifications(userId);
  console.log('Seed complete');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
