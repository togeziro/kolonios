import { pgEnum, pgTable, serial, text, timestamp, numeric } from 'drizzle-orm/pg-core';

export const productCategoryEnum = pgEnum('product_category', [
  'Electronics',
  'Furniture',
  'Clothing',
  'Toys',
  'Groceries',
  'Books',
  'Jewelry',
  'Beauty Products'
]);

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  photo_url: text('photo_url'),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  category: productCategoryEnum('category').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
