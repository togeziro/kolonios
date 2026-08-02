import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
import { customers } from './schema/customers';
import type {
  CustomerFilters,
  CustomersResponse,
  CustomerByIdResponse,
  CustomerMutationPayload
} from '@/features/customers/api/types';
import { buildPagination, buildOrderBy, buildSearchCondition, buildStatusCondition } from './utils';

const sortColumnMap = {
  full_name: customers.full_name,
  email: customers.email,
  customer_code: customers.customer_code,
  status: customers.status,
  created_at: customers.created_at
} as const;

function serialize(row: typeof customers.$inferSelect) {
  return {
    ...row,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };
}

async function getCustomerOr404(id: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  if (!customer) {
    return null;
  }
  return customer;
}

async function generateCustomerCode(): Promise<string> {
  const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(customers);
  const next = (result.count ?? 0) + 1;
  return `CUST-${String(next).padStart(4, '0')}`;
}

export async function listCustomers(filters: CustomerFilters): Promise<CustomersResponse> {
  try {
    const { limit, offset } = buildPagination(filters);

    const statusCondition = buildStatusCondition(customers.status, filters.status);
    const searchCondition = buildSearchCondition(
      [customers.full_name, customers.email, customers.phone, customers.customer_code],
      filters.search
    );
    const where = and(statusCondition, searchCondition);
    const orderBy = buildOrderBy(filters, sortColumnMap) ?? asc(customers.created_at);

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(customers).where(where).orderBy(orderBy).limit(limit).offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(customers)
        .where(where)
    ]);

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Customers fetched from PostgreSQL',
      total_customers: count,
      offset,
      limit,
      customers: rows.map(serialize)
    };
  } catch (e) {
    mapDbError(e, 'customers.listCustomers');
  }
}

export async function getCustomerById(id: string): Promise<CustomerByIdResponse> {
  try {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));

    if (!customer) {
      return {
        success: false,
        time: new Date().toISOString(),
        message: `Customer with ID ${id} not found`
      } as CustomerByIdResponse;
    }

    return {
      success: true,
      time: new Date().toISOString(),
      message: `Customer with ID ${id} found`,
      customer: serialize(customer)
    };
  } catch (e) {
    mapDbError(e, 'customers.getCustomerById');
  }
}

export async function createCustomer(data: CustomerMutationPayload & { created_by: string }) {
  try {
    const customer_code = await generateCustomerCode();
    const [created] = await db
      .insert(customers)
      .values({
        id: data.id,
        customer_code,
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        address: data.address ?? '',
        latitude: data.latitude ?? 0,
        longitude: data.longitude ?? 0,
        id_card_number: data.id_card_number ?? '',
        id_card_photo: data.id_card_photo ?? '',
        service_data: data.service_data ?? '{}',
        billing_address: data.billing_address ?? '',
        notes: data.notes ?? '',
        status: data.status ?? 'active',
        created_by: data.created_by
      })
      .returning();

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Customer created successfully',
      customer: serialize(created)
    };
  } catch (e) {
    mapDbError(e, 'customers.createCustomer');
  }
}

export async function updateCustomer(id: string, data: CustomerMutationPayload) {
  try {
    const existing = await getCustomerOr404(id);
    if (!existing) {
      return { success: false, message: `Customer with ID ${id} not found` };
    }

    const [updated] = await db
      .update(customers)
      .set({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        address: data.address ?? '',
        latitude: data.latitude ?? 0,
        longitude: data.longitude ?? 0,
        id_card_number: data.id_card_number ?? '',
        id_card_photo: data.id_card_photo ?? '',
        service_data: data.service_data ?? '{}',
        billing_address: data.billing_address ?? '',
        notes: data.notes ?? '',
        status: data.status ?? 'active',
        updated_at: new Date()
      })
      .where(eq(customers.id, id))
      .returning();

    return {
      success: true,
      time: new Date().toISOString(),
      message: 'Customer updated successfully',
      customer: serialize(updated)
    };
  } catch (e) {
    mapDbError(e, 'customers.updateCustomer');
  }
}

export async function deleteCustomer(id: string) {
  try {
    const existing = await getCustomerOr404(id);
    if (!existing) {
      return { success: false, message: `Customer with ID ${id} not found` };
    }

    await db.delete(customers).where(eq(customers.id, id));

    return { success: true, message: 'Customer deleted successfully' };
  } catch (e) {
    mapDbError(e, 'customers.deleteCustomer');
  }
}
