import { eq, asc, and } from 'drizzle-orm';
import { db } from './index';
import { mapDbError } from '../errors';
import { departments, designations } from './schema/masterdata';

export async function getDepartments() {
  try {
    const rows = await db.select().from(departments).orderBy(asc(departments.name));
    return { success: true, departments: rows };
  } catch (e) {
    mapDbError(e, 'masterdata.getDepartments');
  }
}

export async function getDepartmentById(id: number) {
  try {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return { success: true, department: dept ?? null };
  } catch (e) {
    mapDbError(e, 'masterdata.getDepartmentById');
  }
}

export async function createDepartment(data: { name: string; code: string; description?: string }) {
  try {
    const [dept] = await db
      .insert(departments)
      .values({ name: data.name, code: data.code, description: data.description ?? null })
      .returning();
    return { success: true, message: 'Department created', department: dept };
  } catch (e) {
    mapDbError(e, 'masterdata.createDepartment');
  }
}

export async function updateDepartment(
  id: number,
  data: { name?: string; code?: string; description?: string; is_active?: boolean }
) {
  try {
    const [dept] = await db
      .update(departments)
      .set({ ...data, updated_at: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return { success: true, message: 'Department updated', department: dept };
  } catch (e) {
    mapDbError(e, 'masterdata.updateDepartment');
  }
}

export async function deleteDepartment(id: number) {
  try {
    const linked = await db
      .select({ id: designations.id })
      .from(designations)
      .where(eq(designations.department_id, id))
      .limit(1);
    if (linked.length > 0) {
      return { success: false, message: 'Cannot delete: department has linked designations' };
    }
    await db.delete(departments).where(eq(departments.id, id));
    return { success: true, message: 'Department deleted' };
  } catch (e) {
    mapDbError(e, 'masterdata.deleteDepartment');
  }
}

export async function getDesignations(filters?: { department_id?: number }) {
  try {
    const conditions = [];
    if (filters?.department_id) {
      conditions.push(eq(designations.department_id, filters.department_id));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        designation: designations,
        department: departments
      })
      .from(designations)
      .leftJoin(departments, eq(designations.department_id, departments.id))
      .where(where)
      .orderBy(asc(designations.name));

    return { success: true, designations: rows };
  } catch (e) {
    mapDbError(e, 'masterdata.getDesignations');
  }
}

export async function getDesignationById(id: number) {
  try {
    const [row] = await db
      .select({
        designation: designations,
        department: departments
      })
      .from(designations)
      .leftJoin(departments, eq(designations.department_id, departments.id))
      .where(eq(designations.id, id))
      .limit(1);
    return { success: true, designation: row ?? null };
  } catch (e) {
    mapDbError(e, 'masterdata.getDesignationById');
  }
}

export async function createDesignation(data: {
  name: string;
  code: string;
  department_id?: number;
  description?: string;
  base_salary?: number;
}) {
  try {
    const [row] = await db
      .insert(designations)
      .values({
        name: data.name,
        code: data.code,
        department_id: data.department_id ?? null,
        description: data.description ?? null,
        base_salary: data.base_salary ?? null
      })
      .returning();
    return { success: true, message: 'Designation created', designation: row };
  } catch (e) {
    mapDbError(e, 'masterdata.createDesignation');
  }
}

export async function updateDesignation(
  id: number,
  data: {
    name?: string;
    code?: string;
    department_id?: number | null;
    description?: string;
    base_salary?: number;
    is_active?: boolean;
  }
) {
  try {
    const [row] = await db
      .update(designations)
      .set({ ...data, updated_at: new Date() })
      .where(eq(designations.id, id))
      .returning();
    return { success: true, message: 'Designation updated', designation: row };
  } catch (e) {
    mapDbError(e, 'masterdata.updateDesignation');
  }
}

export async function deleteDesignation(id: number) {
  try {
    await db.delete(designations).where(eq(designations.id, id));
    return { success: true, message: 'Designation deleted' };
  } catch (e) {
    mapDbError(e, 'masterdata.deleteDesignation');
  }
}

export async function getDesignationsAsOptions() {
  try {
    const rows = await db
      .select({
        id: designations.id,
        name: designations.name,
        code: designations.code,
        department_id: designations.department_id,
        department_name: departments.name
      })
      .from(designations)
      .leftJoin(departments, eq(designations.department_id, departments.id))
      .where(eq(designations.is_active, true))
      .orderBy(asc(designations.name));

    return {
      success: true,
      options: rows.map((r) => ({
        value: String(r.id),
        label: r.department_name ? `${r.name} (${r.department_name})` : r.name
      }))
    };
  } catch (e) {
    mapDbError(e, 'masterdata.getDesignationsAsOptions');
  }
}
