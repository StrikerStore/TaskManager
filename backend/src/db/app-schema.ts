import { sql } from "drizzle-orm";
import { organization, user } from "./auth-schema.js";
import {
  boolean,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

export const taskStatuses = ["todo", "in_progress", "done"] as const;
export const taskPriorities = ["low", "medium", "high", "urgent"] as const;

export type TaskStatus = (typeof taskStatuses)[number];
export type TaskPriority = (typeof taskPriorities)[number];

/** A project groups tasks inside one team (organization). */
export const project = mysqlTable(
  "project",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    color: varchar("color", { length: 16 }).notNull().default("#6366f1"),
    archived: boolean("archived").notNull().default(false),
    createdById: varchar("created_by_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("project_org_idx").on(t.organizationId, t.archived),
  ],
);

/**
 * A task. Team tasks have `isPersonal = false` and are visible to every member
 * of the organization. Personal tasks are visible only to `createdById`.
 */
export const task = mysqlTable(
  "task",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: varchar("project_id", { length: 36 }).references(() => project.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", taskStatuses).notNull().default("todo"),
    priority: mysqlEnum("priority", taskPriorities).notNull().default("medium"),
    assigneeId: varchar("assignee_id", { length: 36 }).references(() => user.id, {
      onDelete: "set null",
    }),
    createdById: varchar("created_by_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dueDate: datetime("due_date", { fsp: 3 }),
    isPersonal: boolean("is_personal").notNull().default(false),
    completedAt: datetime("completed_at", { fsp: 3 }),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("task_org_status_idx").on(t.organizationId, t.status),
    index("task_org_project_idx").on(t.organizationId, t.projectId),
    index("task_assignee_idx").on(t.organizationId, t.assigneeId),
    index("task_personal_idx").on(t.organizationId, t.createdById, t.isPersonal),
    index("task_due_idx").on(t.organizationId, t.dueDate),
  ],
);

export type Project = typeof project.$inferSelect;
export type Task = typeof task.$inferSelect;
export type NewTask = typeof task.$inferInsert;

export const recurrenceFrequencies = ["daily", "weekly", "biweekly", "monthly"] as const;
export type RecurrenceFrequency = (typeof recurrenceFrequencies)[number];

/**
 * A rule that creates a task on a schedule. The scheduler reads `nextRunAt`,
 * creates a task, then moves `nextRunAt` to the following occurrence.
 */
export const recurringTask = mysqlTable(
  "recurring_task",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 300 }).notNull(),
    description: text("description"),
    projectId: varchar("project_id", { length: 36 }).references(() => project.id, {
      onDelete: "set null",
    }),
    priority: mysqlEnum("priority", taskPriorities).notNull().default("medium"),
    /** Every generated task goes to this person. */
    assigneeId: varchar("assignee_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdById: varchar("created_by_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    isPersonal: boolean("is_personal").notNull().default(false),

    frequency: mysqlEnum("frequency", recurrenceFrequencies).notNull(),
    /** Sorted CSV of 0-6 (Sunday-Saturday) for weekly and biweekly rules, e.g. "1,4". */
    weekdays: varchar("weekdays", { length: 20 }),
    /** Sorted CSV of 1-31 for monthly rules, e.g. "1,15"; clamped in short months. */
    monthDays: varchar("month_days", { length: 100 }),
    /** Local time of day the task appears, as "HH:MM". */
    triggerTime: varchar("trigger_time", { length: 5 }).notNull().default("09:00"),
    /** The generated task is due this many days after it appears. */
    dueOffsetDays: int("due_offset_days").notNull().default(0),

    active: boolean("active").notNull().default(true),
    nextRunAt: datetime("next_run_at", { fsp: 3 }).notNull(),
    lastRunAt: datetime("last_run_at", { fsp: 3 }),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("recurring_org_idx").on(t.organizationId, t.active),
    index("recurring_due_idx").on(t.active, t.nextRunAt),
  ],
);

export type RecurringTask = typeof recurringTask.$inferSelect;

/** Each team has one short code that people type to ask to join. */
export const teamCode = mysqlTable("team_code", {
  organizationId: varchar("organization_id", { length: 36 })
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 12 }).notNull().unique(),
  createdAt: datetime("created_at", { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
  updatedAt: datetime("updated_at", { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$onUpdate(() => new Date()),
});

export const joinRequestStatuses = ["pending", "accepted", "rejected"] as const;
export type JoinRequestStatus = (typeof joinRequestStatuses)[number];

/**
 * A request to join a team, made by entering its code and decided by an owner
 * or admin. At most one pending request per person per team (enforced in code).
 */
export const joinRequest = mysqlTable(
  "join_request",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", joinRequestStatuses).notNull().default("pending"),
    decidedById: varchar("decided_by_id", { length: 36 }).references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: datetime("decided_at", { fsp: 3 }),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("join_request_team_idx").on(t.organizationId, t.status),
    index("join_request_user_idx").on(t.userId, t.status),
  ],
);
