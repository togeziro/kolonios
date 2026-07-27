import { pgTable, text, timestamp, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';

export const customers = pgTable('customers', {
  id: text('id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  customer_code: text('customer_code').notNull().unique(),
  full_name: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull().default(''),
  latitude: real('latitude').notNull().default(0),
  longitude: real('longitude').notNull().default(0),
  id_card_number: text('id_card_number').notNull().default('').unique(),
  id_card_photo: text('id_card_photo').notNull().default(''),
  service_data: text('service_data').notNull().default('{}'),
  billing_address: text('billing_address').notNull().default(''),
  notes: text('notes').notNull().default(''),
  status: text('status').notNull().default('active'),
  created_by: text('created_by')
    .notNull()
    .references(() => user.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const customerRelations = relations(customers, ({ one }) => ({
  user: one(user, {
    fields: [customers.id],
    references: [user.id]
  }),
  creator: one(user, {
    fields: [customers.created_by],
    references: [user.id]
  })
}));

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
