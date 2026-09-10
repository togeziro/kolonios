import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';
import { employees } from './employees';
import { departments, designations } from './masterdata';

/**
 * Career Timeline — see ADR-0007 + ADR-0008 and
 * `.scratch/career-timeline/spec.md`.
 *
 * One row per Career Event for one employee. Categories are limited to
 * `position`, `division`, `employment_status`, `start_work`. The
 * `effective_date` column is the canonical "when did this happen" date;
 * `created_at` is the system-recorded wall-clock that anchors audit
 * traceability (they can diverge — see ADR-0008).
 *
 * For `position` and `division` the from/to values are stored as BOTH a
 * label snapshot (immutable to masterdata renames) AND a nullable FK to
 * the relevant masterdata row (join key for "who was ever in X" queries).
 */

export const careerEventCategoryEnum = pgEnum('career_event_category', [
  'position',
  'division',
  'employment_status',
  'start_work'
]);

export const employeeCareerEvents = pgTable(
  'employee_career_events',
  {
    id: serial('id').primaryKey(),
    employee_id: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    category: careerEventCategoryEnum('category').notNull(),
    effective_date: date('effective_date').notNull(),
    notes: text('notes'),
    actor_user_id: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
    from_designation_id: integer('from_designation_id').references(() => designations.id, {
      onDelete: 'set null'
    }),
    to_designation_id: integer('to_designation_id').references(() => designations.id, {
      onDelete: 'set null'
    }),
    from_department_id: integer('from_department_id').references(() => departments.id, {
      onDelete: 'set null'
    }),
    to_department_id: integer('to_department_id').references(() => departments.id, {
      onDelete: 'set null'
    }),
    from_label: text('from_label'),
    to_label: text('to_label').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (t) => [
    // Timeline read path: per-employee reverse-chronological scan.
    index('employee_career_events_employee_effective_idx').on(
      t.employee_id,
      t.effective_date.desc()
    )
  ]
);

export const employeeCareerEventRelations = relations(employeeCareerEvents, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeCareerEvents.employee_id],
    references: [employees.id]
  }),
  actor: one(user, {
    fields: [employeeCareerEvents.actor_user_id],
    references: [user.id]
  }),
  fromDesignation: one(designations, {
    fields: [employeeCareerEvents.from_designation_id],
    references: [designations.id]
  }),
  toDesignation: one(designations, {
    fields: [employeeCareerEvents.to_designation_id],
    references: [designations.id]
  }),
  fromDepartment: one(departments, {
    fields: [employeeCareerEvents.from_department_id],
    references: [departments.id]
  }),
  toDepartment: one(departments, {
    fields: [employeeCareerEvents.to_department_id],
    references: [departments.id]
  })
}));

export type CareerEvent = typeof employeeCareerEvents.$inferSelect;
export type NewCareerEvent = typeof employeeCareerEvents.$inferInsert;
export type CareerEventCategory = (typeof careerEventCategoryEnum.enumValues)[number];
