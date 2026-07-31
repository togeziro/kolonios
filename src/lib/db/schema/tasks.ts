import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';
import { locations } from './attendance';
import { departments, designations } from './masterdata';

export const taskStatusEnum = pgEnum('task_status', [
  'assigned',
  'available',
  'in_progress',
  'completed',
  'cancelled'
]);

export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high']);

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  task_type: text('task_type').notNull().default('general'),
  status: taskStatusEnum('status').notNull().default('available'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  location_id: integer('location_id').references(() => locations.id),
  due_at: timestamp('due_at'),
  estimated_minutes: integer('estimated_minutes'),
  assigned_to: text('assigned_to').references(() => user.id),
  taken_by: text('taken_by').references(() => user.id),
  taken_at: timestamp('taken_at'),
  completed_at: timestamp('completed_at'),
  created_by: text('created_by')
    .notNull()
    .references(() => user.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const taskRequirements = pgTable('task_requirements', {
  id: serial('id').primaryKey(),
  task_id: integer('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  department_id: integer('department_id').references(() => departments.id),
  designation_id: integer('designation_id').references(() => designations.id),
  location_id: integer('location_id').references(() => locations.id),
  skill: text('skill')
});

export const employeeSkills = pgTable(
  'employee_skills',
  {
    id: serial('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    skill: text('skill').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (t) => [uniqueIndex('employee_skills_user_skill_unique').on(t.user_id, t.skill)]
);

export const taskRelations = relations(tasks, ({ one, many }) => ({
  location: one(locations, {
    fields: [tasks.location_id],
    references: [locations.id]
  }),
  assignedUser: one(user, {
    fields: [tasks.assigned_to],
    references: [user.id]
  }),
  takenUser: one(user, {
    fields: [tasks.taken_by],
    references: [user.id]
  }),
  requirements: many(taskRequirements)
}));

export const taskRequirementRelations = relations(taskRequirements, ({ one }) => ({
  task: one(tasks, {
    fields: [taskRequirements.task_id],
    references: [tasks.id]
  })
}));

export const employeeSkillRelations = relations(employeeSkills, ({ one }) => ({
  user: one(user, {
    fields: [employeeSkills.user_id],
    references: [user.id]
  })
}));

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskRequirement = typeof taskRequirements.$inferSelect;
export type EmployeeSkill = typeof employeeSkills.$inferSelect;
