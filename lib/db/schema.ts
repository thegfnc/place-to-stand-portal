import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'CLIENT'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  full_name: text('full_name'),
  role: userRoleEnum('role').notNull(),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at', {
    mode: 'string',
    withTimezone: true,
  })
    .default(sql`now()`)
    .notNull(),
  updated_at: timestamp('updated_at', {
    mode: 'string',
    withTimezone: true,
  })
    .default(sql`now()`)
    .notNull(),
  deleted_at: timestamp('deleted_at', {
    mode: 'string',
    withTimezone: true,
  }),
})

export const clientMembers = pgTable('client_members', {
  id: serial('id').primaryKey(),
  client_id: uuid('client_id').notNull(),
  user_id: uuid('user_id').notNull(),
  created_at: timestamp('created_at', {
    mode: 'string',
    withTimezone: true,
  })
    .default(sql`now()`)
    .notNull(),
  deleted_at: timestamp('deleted_at', {
    mode: 'string',
    withTimezone: true,
  }),
})

export const taskAssignees = pgTable('task_assignees', {
  id: serial('id').primaryKey(),
  task_id: uuid('task_id').notNull(),
  user_id: uuid('user_id').notNull(),
  created_at: timestamp('created_at', {
    mode: 'string',
    withTimezone: true,
  })
    .default(sql`now()`)
    .notNull(),
  deleted_at: timestamp('deleted_at', {
    mode: 'string',
    withTimezone: true,
  }),
})

export type UserRow = typeof users.$inferSelect
export type ClientMemberRow = typeof clientMembers.$inferSelect
export type TaskAssigneeRow = typeof taskAssignees.$inferSelect
