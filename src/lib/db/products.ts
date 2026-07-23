// ============================================================
// Product data access (server-only) — PostgreSQL via Drizzle
// ============================================================
// Imported dynamically from the server-function wrappers in
// src/features/products/api/service.ts, so the `postgres` driver
// never ends up in the client bundle.

import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from './index';
import { DomainError, mapDbError } from '../errors';
import { products, productCategoryEnum } from './schema/products';
import type {
  ProductFilters,
  ProductsResponse,
  ProductByIdResponse,
  ProductMutationPayload
} from '@/features/products/api/types';

type ProductCategory = (typeof productCategoryEnum.enumValues)[number];

function parseSort(sort?: string) {
  if (!sort) return undefined;
  try {
    const items = JSON.parse(sort) as { id: string; desc: boolean }[];
    return items[0];
  } catch {
    return undefined;
  }
}

function sortColumn(id: string) {
  switch (id) {
    case 'name':
      return products.name;
    case 'price':
      return products.price;
    case 'category':
      return products.category;
    case 'created_at':
      return products.created_at;
    case 'updated_at':
      return products.updated_at;
    case 'id':
      return products.id;
    default:
      return undefined;
  }
}

function validateCategory(category: string): ProductCategory {
  const value = productCategoryEnum.enumValues.find((c) => c === category);
  if (!value) {
    throw new DomainError(`Invalid product category: "${category}"`);
  }
  return value;
}

function validatePrice(price: unknown): number {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new DomainError(`Invalid product price: ${price}`);
  }
  return price;
}

function serialize(row: typeof products.$inferSelect) {
  return {
    ...row,
    price: Number(row.price),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };
}

async function getProductOr404(id: number) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) {
    return null;
  }
  return product;
}

export async function getProducts(filters: ProductFilters): Promise<ProductsResponse> {
  try {
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 10)));
    const offset = (page - 1) * limit;

    const categories = Array.isArray(filters.categories)
      ? (filters.categories.filter((c): c is ProductCategory =>
          productCategoryEnum.enumValues.includes(c as ProductCategory)
        ) as ProductCategory[])
      : filters.categories
        ? (filters.categories
            .split(',')
            .map((c) => c.trim())
            .filter((c): c is ProductCategory =>
              productCategoryEnum.enumValues.includes(c as ProductCategory)
            ) as ProductCategory[])
        : [];
    const search = filters.search?.trim();

    const conditions = [];
    if (categories.length > 0) {
      conditions.push(inArray(products.category, categories));
    }
    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.description, `%${search}%`),
          ilike(sql`${products.category}::text`, `%${search}%`)
        )
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortItem = parseSort(filters.sort);
    const col = sortItem ? sortColumn(sortItem.id) : undefined;
    const orderBy = col ? (sortItem!.desc ? desc(col) : asc(col)) : asc(products.id);

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(products).where(where).orderBy(orderBy).limit(limit).offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(where)
    ]);

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Products fetched from PostgreSQL',
      total_products: count,
      offset,
      limit,
      products: rows.map(serialize)
    };
  } catch (e) {
    mapDbError(e, 'products.getProducts');
  }
}

export async function getProductById(id: number): Promise<ProductByIdResponse> {
  try {
    const [product] = await db.select().from(products).where(eq(products.id, id));

    if (!product) {
      return {
        success: false,
        time: new Date().toISOString(),
        message: `Product with ID ${id} not found`
      } as ProductByIdResponse;
    }

    return {
      success: true,
      time: new Date().toISOString(),
      message: `Product with ID ${id} found`,
      product: serialize(product)
    };
  } catch (e) {
    mapDbError(e, 'products.getProductById');
  }
}

export async function createProduct(data: ProductMutationPayload) {
  try {
    const [created] = await db
      .insert(products)
      .values({
        name: data.name,
        description: data.description,
        price: String(validatePrice(data.price)),
        category: validateCategory(data.category)
      })
      .returning();

    const photo_url = `https://api.slingacademy.com/public/sample-products/${created.id}.png`;
    const [updated] = await db
      .update(products)
      .set({ photo_url })
      .where(eq(products.id, created.id))
      .returning();

    return {
      success: true,
      message: 'Product created successfully',
      product: serialize(updated)
    };
  } catch (e) {
    mapDbError(e, 'products.createProduct');
  }
}

export async function updateProduct(id: number, data: ProductMutationPayload) {
  try {
    const existing = await getProductOr404(id);
    if (!existing) {
      return { success: false, message: `Product with ID ${id} not found` };
    }

    const [updated] = await db
      .update(products)
      .set({
        name: data.name,
        description: data.description,
        price: String(validatePrice(data.price)),
        category: validateCategory(data.category),
        updated_at: new Date()
      })
      .where(eq(products.id, id))
      .returning();

    return {
      success: true,
      message: 'Product updated successfully',
      product: serialize(updated)
    };
  } catch (e) {
    mapDbError(e, 'products.updateProduct');
  }
}

export async function deleteProduct(id: number) {
  try {
    const existing = await getProductOr404(id);
    if (!existing) {
      return { success: false, message: `Product with ID ${id} not found` };
    }

    await db.delete(products).where(eq(products.id, id));

    return { success: true, message: 'Product deleted successfully' };
  } catch (e) {
    mapDbError(e, 'products.deleteProduct');
  }
}
