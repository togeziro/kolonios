import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  smallint,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { user } from '../auth-schema';
import { locations } from './attendance';
import { departments, designations } from './masterdata';
import { customers } from './customers';

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'assigned',
  'in_progress',
  'submitted',
  'approved',
  'rejected',
  'rework',
  'completed',
  'cancelled'
]);

export const ticketLegStatusEnum = pgEnum('ticket_leg_status', [
  'open',
  'assigned',
  'in_progress',
  'submitted',
  'approved',
  'rejected',
  'rework',
  'completed'
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high']);

export const ticketChannelEnum = pgEnum('ticket_channel', [
  'whatsapp',
  'phone',
  'email',
  'walk_in',
  'field',
  'others'
]);

export const ticketTaskTypeEnum = pgEnum('ticket_task_type', [
  'installation',
  'maintenance',
  'inspection',
  'data',
  'sales',
  'others'
]);

export const ticketMaterialSourceEnum = pgEnum('ticket_material_source', ['warehouse', 'van']);

export const ticketWorklogKindEnum = pgEnum('ticket_worklog_kind', [
  'note',
  'photo',
  'location',
  'meter'
]);

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  ticket_code: text('ticket_code'),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  channel: ticketChannelEnum('channel').notNull().default('field'),
  requester_id: text('requester_id').references(() => user.id),
  customer_id: text('customer_id').references(() => customers.id),
  asset_name: text('asset_name').notNull().default(''),
  task_type: ticketTaskTypeEnum('task_type').notNull().default('installation'),
  status: ticketStatusEnum('status').notNull().default('open'),
  priority: ticketPriorityEnum('priority').notNull().default('medium'),
  location_id: integer('location_id').references(() => locations.id),
  due_at: timestamp('due_at'),
  estimated_minutes: integer('estimated_minutes'),
  rating: smallint('rating'),
  assigned_to: text('assigned_to').references(() => user.id),
  taken_by: text('taken_by').references(() => user.id),
  taken_at: timestamp('taken_at'),
  completed_at: timestamp('completed_at'),
  submitted_at: timestamp('submitted_at'),
  reviewed_by: text('reviewed_by').references(() => user.id),
  review_note: text('review_note').notNull().default(''),
  created_by: text('created_by')
    .notNull()
    .references(() => user.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const ticketLegs = pgTable(
  'ticket_legs',
  {
    id: serial('id').primaryKey(),
    ticket_id: integer('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    leg_number: integer('leg_number').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: ticketLegStatusEnum('status').notNull().default('open'),
    assignee_id: text('assignee_id').references(() => user.id),
    taken_at: timestamp('taken_at'),
    completed_at: timestamp('completed_at'),
    notes: text('notes').notNull().default(''),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull()
  },
  (t) => [uniqueIndex('ticket_legs_ticket_leg_number_unique').on(t.ticket_id, t.leg_number)]
);

export const ticketMaterials = pgTable('ticket_materials', {
  id: serial('id').primaryKey(),
  leg_id: integer('leg_id')
    .notNull()
    .references(() => ticketLegs.id, { onDelete: 'cascade' }),
  material_name: text('material_name').notNull(),
  qty: integer('qty').notNull().default(1),
  unit: text('unit').notNull().default(''),
  source: ticketMaterialSourceEnum('source').notNull().default('van'),
  barcode: text('barcode').notNull().default('')
});

export const ticketPhotos = pgTable('ticket_photos', {
  id: serial('id').primaryKey(),
  leg_id: integer('leg_id')
    .notNull()
    .references(() => ticketLegs.id, { onDelete: 'cascade' }),
  file_url: text('file_url').notNull(),
  caption: text('caption').notNull().default(''),
  captured_at: timestamp('captured_at').defaultNow().notNull(),
  uploader_id: text('uploader_id').references(() => user.id)
});

export const ticketWorklog = pgTable('ticket_worklog', {
  id: serial('id').primaryKey(),
  leg_id: integer('leg_id')
    .notNull()
    .references(() => ticketLegs.id, { onDelete: 'cascade' }),
  kind: ticketWorklogKindEnum('kind').notNull(),
  body: text('body').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  created_by: text('created_by').references(() => user.id)
});

export const taskRequirements = pgTable('task_requirements', {
  id: serial('id').primaryKey(),
  task_id: integer('task_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
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

export const ticketRelations = relations(tickets, ({ one, many }) => ({
  location: one(locations, {
    fields: [tickets.location_id],
    references: [locations.id]
  }),
  customer: one(customers, {
    fields: [tickets.customer_id],
    references: [customers.id]
  }),
  requester: one(user, {
    fields: [tickets.requester_id],
    references: [user.id]
  }),
  assignedUser: one(user, {
    fields: [tickets.assigned_to],
    references: [user.id]
  }),
  takenUser: one(user, {
    fields: [tickets.taken_by],
    references: [user.id]
  }),
  creator: one(user, {
    fields: [tickets.created_by],
    references: [user.id]
  }),
  legs: many(ticketLegs),
  requirements: many(taskRequirements)
}));

export const ticketLegRelations = relations(ticketLegs, ({ one, many }) => ({
  ticket: one(tickets, {
    fields: [ticketLegs.ticket_id],
    references: [tickets.id]
  }),
  assignee: one(user, {
    fields: [ticketLegs.assignee_id],
    references: [user.id]
  }),
  materials: many(ticketMaterials),
  photos: many(ticketPhotos),
  worklog: many(ticketWorklog)
}));

export const ticketMaterialRelations = relations(ticketMaterials, ({ one }) => ({
  leg: one(ticketLegs, {
    fields: [ticketMaterials.leg_id],
    references: [ticketLegs.id]
  })
}));

export const ticketWorklogRelations = relations(ticketWorklog, ({ one }) => ({
  leg: one(ticketLegs, {
    fields: [ticketWorklog.leg_id],
    references: [ticketLegs.id]
  })
}));

export const ticketPhotoRelations = relations(ticketPhotos, ({ one }) => ({
  leg: one(ticketLegs, {
    fields: [ticketPhotos.leg_id],
    references: [ticketLegs.id]
  })
}));

export const taskRequirementRelations = relations(taskRequirements, ({ one }) => ({
  task: one(tickets, {
    fields: [taskRequirements.task_id],
    references: [tickets.id]
  })
}));

export const employeeSkillRelations = relations(employeeSkills, ({ one }) => ({
  user: one(user, {
    fields: [employeeSkills.user_id],
    references: [user.id]
  })
}));

export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type TicketLegStatus = (typeof ticketLegStatusEnum.enumValues)[number];
export type TicketPriority = (typeof ticketPriorityEnum.enumValues)[number];
export type TicketChannel = (typeof ticketChannelEnum.enumValues)[number];
export type TicketTaskType = (typeof ticketTaskTypeEnum.enumValues)[number];
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketLeg = typeof ticketLegs.$inferSelect;
export type TicketMaterial = typeof ticketMaterials.$inferSelect;
export type TicketPhoto = typeof ticketPhotos.$inferSelect;
export type TicketWorklogKind = (typeof ticketWorklogKindEnum.enumValues)[number];
export type TicketWorklog = typeof ticketWorklog.$inferSelect;
export type NewTicketWorklog = typeof ticketWorklog.$inferInsert;
export type TaskRequirement = typeof taskRequirements.$inferSelect;
export type EmployeeSkill = typeof employeeSkills.$inferSelect;
