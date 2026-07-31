import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/lib/db/schema/products.ts',
    './src/lib/db/schema/notifications.ts',
    './src/lib/db/schema/attendance.ts',
    './src/lib/db/schema/masterdata.ts',
    './src/lib/db/schema/customers.ts',
    './src/lib/db/auth-schema.ts'
  ],
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://tanstack:tanstack@localhost:5432/kolonios'
  }
});
