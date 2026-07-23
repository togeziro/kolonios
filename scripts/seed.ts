import { faker } from '@faker-js/faker';
import { db } from '../src/lib/db';
import { auth } from '../src/lib/auth/auth.server';
import { products, kanbanColumns, kanbanTasks, notifications } from '../src/lib/db/schema';
import { user } from '../src/lib/db/auth-schema';
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



async function seedKanban() {
  await db.delete(kanbanTasks);
  await db.delete(kanbanColumns);


  const columnData = [
    { slug: 'backlog', title: 'Backlog', position: 0 },
    { slug: 'inProgress', title: 'In Progress', position: 1 },
    { slug: 'review', title: 'Review', position: 2 },
    { slug: 'done', title: 'Done', position: 3 },
  ];

  await db.insert(kanbanColumns).values(columnData);

  const taskData: (typeof kanbanTasks.$inferInsert)[] = [
    { column_slug: 'backlog', title: 'Migrate to Stripe billing API', priority: 'high', assignee: 'Sarah Chen', due_date: '2026-04-08', position: 0 },
    { column_slug: 'backlog', title: 'Add CSV export to reports', priority: 'medium', assignee: 'Marcus Rivera', due_date: '2026-04-12', position: 1 },
    { column_slug: 'backlog', title: 'Update onboarding flow copy', priority: 'low', assignee: 'Priya Sharma', due_date: '2026-04-15', position: 2 },
    { column_slug: 'backlog', title: 'Audit RBAC permissions', priority: 'medium', assignee: 'Jordan Kim', due_date: '2026-04-10', position: 3 },
    { column_slug: 'inProgress', title: 'Refactor notification service', priority: 'high', assignee: 'Alex Turner', due_date: '2026-04-03', position: 0 },
    { column_slug: 'inProgress', title: 'Build team invitation flow', priority: 'medium', assignee: 'Emily Nakamura', due_date: '2026-04-06', position: 1 },
    { column_slug: 'inProgress', title: 'Fix timezone handling in scheduler', priority: 'high', assignee: 'Sarah Chen', due_date: '2026-04-04', position: 2 },
    { column_slug: 'done', title: 'SSO integration with Okta', priority: 'high', assignee: 'Jordan Kim', due_date: '2026-03-22', position: 0 },
    { column_slug: 'done', title: 'Dashboard analytics charts', priority: 'medium', assignee: 'Marcus Rivera', due_date: '2026-03-20', position: 1 },
    { column_slug: 'done', title: 'Webhook retry mechanism', priority: 'low', assignee: 'Alex Turner', due_date: '2026-03-18', position: 2 },
  ];

  await db.insert(kanbanTasks).values(taskData);
  console.log(`Seeded ${columnData.length} columns, ${taskData.length} tasks`);
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
    { title: 'Task assigned to you', body: 'You have been assigned "Update dashboard analytics" on the Kanban board.', actionId: 'open', actionLabel: 'Open kanban' },
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

async function main() {
  faker.seed(42);
  await seedProducts();
  await seedKanban();
  const userId = await seedUsers();
  await seedNotifications(userId);
  console.log('Seed complete');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
