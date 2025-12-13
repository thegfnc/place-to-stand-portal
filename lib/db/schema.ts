import {
  pgTable,
  index,
  foreignKey,
  unique,
  pgPolicy,
  uuid,
  text,
  timestamp,
  bigint,
  check,
  numeric,
  uniqueIndex,
  date,
  smallint,
  jsonb,
  pgView,
  pgEnum,
  integer,
  primaryKey,
  boolean,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const taskStatus = pgEnum('task_status', [
  'BACKLOG',
  'ON_DECK',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'DONE',
  'ARCHIVED',
])
export const userRole = pgEnum('user_role', ['ADMIN', 'CLIENT'])
export const clientBillingType = pgEnum('client_billing_type', [
  'prepaid',
  'net_30',
])
export const projectType = pgEnum('project_type', [
  'CLIENT',
  'PERSONAL',
  'INTERNAL',
])
export const leadStatus = pgEnum('lead_status', [
  'NEW_OPPORTUNITIES',
  'ACTIVE_OPPORTUNITIES',
  'PROPOSAL_SENT',
  'ON_ICE',
  'CLOSED_WON',
  'CLOSED_LOST',
  'UNQUALIFIED',
])

export const leadSourceType = pgEnum('lead_source_type', [
  'REFERRAL',
  'WEBSITE',
  'EVENT',
])

export const oauthProvider = pgEnum('oauth_provider', ['GOOGLE', 'GITHUB'])

export const oauthConnectionStatus = pgEnum('oauth_connection_status', [
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'PENDING_REAUTH',
])

export const clients = pgTable(
  'clients',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    slug: text(),
    notes: text(),
    billingType: clientBillingType('billing_type')
      .default('prepaid')
      .notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_clients_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'clients_created_by_fkey',
    }),
    unique('clients_slug_key').on(table.slug),
    pgPolicy('Admins delete clients', {
      as: 'permissive',
      for: 'delete',
      to: ['public'],
      using: sql`is_admin()`,
    }),
    pgPolicy('Admins insert clients', {
      as: 'permissive',
      for: 'insert',
      to: ['public'],
    }),
    pgPolicy('Admins update clients', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
    }),
    pgPolicy('Users view clients', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
  ]
)

// Client contacts: external email addresses associated with clients
export const clientContacts = pgTable(
  'client_contacts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clientId: uuid('client_id').notNull(),
    email: text().notNull(),
    name: text(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // One email per client (prevent duplicates)
    unique('client_contacts_client_email_key').on(table.clientId, table.email),
    // Index for looking up contacts by client
    index('idx_client_contacts_client')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // Index for email matching (critical for performance)
    index('idx_client_contacts_email')
      .using('btree', table.email.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // Index for looking up by email domain (for domain matching)
    index('idx_client_contacts_email_domain')
      .using('btree', sql`split_part(email, '@', 2)`) // expression index
      .where(sql`(deleted_at IS NULL)`),
    // Foreign key to clients
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'client_contacts_client_id_fkey',
    }).onDelete('cascade'),
    // Foreign key to users (who created)
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'client_contacts_created_by_fkey',
    }),
    // RLS Policies
    pgPolicy('Admins manage client contacts', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`is_admin()`,
      withCheck: sql`is_admin()`,
    }),
    pgPolicy('Users view client contacts for accessible clients', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
      using: sql`(
        client_id IN (
          SELECT client_id FROM client_members
          WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
      )`,
    }),
  ]
)

export const taskAssignees = pgTable(
  'task_assignees',
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({
      name: 'task_assignees_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    taskId: uuid('task_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_task_assignees_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'task_assignees_task_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'task_assignees_user_id_fkey',
    }).onDelete('cascade'),
    unique('task_assignees_task_id_user_id_key').on(table.taskId, table.userId),
    pgPolicy('Admins manage task assignees', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`is_admin()`,
      withCheck: sql`is_admin()`,
    }),
    pgPolicy('Users view task assignees', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
  ]
)

export const taskAssigneeMetadata = pgTable(
  'task_assignee_metadata',
  {
    taskId: uuid('task_id').notNull(),
    userId: uuid('user_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_task_assignee_metadata_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'task_assignee_metadata_task_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'task_assignee_metadata_user_id_fkey',
    }).onDelete('cascade'),
    primaryKey({
      name: 'task_assignee_metadata_pkey',
      columns: [table.taskId, table.userId],
    }),
    pgPolicy('Admins manage task assignee metadata', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`is_admin()`,
      withCheck: sql`is_admin()`,
    }),
    pgPolicy('Users view task assignee metadata', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
  ]
)

export const hourBlocks = pgTable(
  'hour_blocks',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    hoursPurchased: numeric('hours_purchased', {
      precision: 6,
      scale: 2,
    }).notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    invoiceNumber: text('invoice_number'),
    clientId: uuid('client_id').notNull(),
  },
  table => [
    index('idx_hour_blocks_client_id')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_hour_blocks_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'hour_blocks_created_by_fkey',
    }),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'hour_blocks_client_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('Admins delete hour blocks', {
      as: 'permissive',
      for: 'delete',
      to: ['public'],
      using: sql`is_admin()`,
    }),
    pgPolicy('Admins insert hour blocks', {
      as: 'permissive',
      for: 'insert',
      to: ['public'],
    }),
    pgPolicy('Admins update hour blocks', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
    }),
    pgPolicy('Users view hour blocks', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
    check(
      'hour_blocks_invoice_number_format',
      sql`(invoice_number IS NULL) OR (invoice_number ~ '^[A-Za-z0-9-]+$'::text)`
    ),
  ]
)

export const clientMembers = pgTable(
  'client_members',
  {
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity({
      name: 'client_members_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 9223372036854775807,
      cache: 1,
    }),
    clientId: uuid('client_id').notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_client_members_client')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_client_members_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'client_members_client_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'client_members_user_id_fkey',
    }).onDelete('cascade'),
    unique('client_members_client_id_user_id_key').on(
      table.clientId,
      table.userId
    ),
    pgPolicy('Admins delete client members', {
      as: 'permissive',
      for: 'delete',
      to: ['public'],
      using: sql`is_admin()`,
    }),
    pgPolicy('Admins insert client members', {
      as: 'permissive',
      for: 'insert',
      to: ['public'],
    }),
    pgPolicy('Admins update client members', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
    }),
    pgPolicy('Users view client members', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
  ]
)

export const projects = pgTable(
  'projects',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clientId: uuid('client_id'),
    name: text().notNull(),
    status: text().default('active').notNull(),
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    slug: text(),
    type: projectType('type').default('CLIENT').notNull(),
  },
  table => [
    index('idx_projects_client')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_projects_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('idx_projects_slug')
      .using('btree', table.slug.asc().nullsLast().op('text_ops'))
      .where(sql`(slug IS NOT NULL)`),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'projects_client_id_fkey',
    }),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'projects_created_by_fkey',
    }),
    pgPolicy('Admins delete projects', {
      as: 'permissive',
      for: 'delete',
      to: ['public'],
      using: sql`is_admin()`,
    }),
    pgPolicy('Users create projects', {
      as: 'permissive',
      for: 'insert',
      to: ['public'],
    }),
    pgPolicy('Users update projects', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
    }),
    pgPolicy('Users view projects', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
    check(
      'projects_type_client_check',
      sql`(
        (type = 'CLIENT' AND client_id IS NOT NULL)
        OR (
          type IN ('PERSONAL', 'INTERNAL')
          AND client_id IS NULL
        )
      )`
    ),
  ]
)

export const taskComments = pgTable(
  'task_comments',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    taskId: uuid('task_id').notNull(),
    authorId: uuid('author_id').notNull(),
    body: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_task_comments_author_id')
      .using('btree', table.authorId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_task_comments_task')
      .using('btree', table.taskId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'task_comments_task_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [users.id],
      name: 'task_comments_author_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('Admins manage task comments', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`is_admin()`,
      withCheck: sql`is_admin()`,
    }),
    pgPolicy('Users create task comments', {
      as: 'permissive',
      for: 'insert',
      to: ['public'],
    }),
    pgPolicy('Users update task comments', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
    }),
    pgPolicy('Users view task comments', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
  ]
)

export const timeLogs = pgTable(
  'time_logs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    projectId: uuid('project_id').notNull(),
    userId: uuid('user_id').notNull(),
    hours: numeric({ precision: 8, scale: 2 }).notNull(),
    loggedOn: date('logged_on')
      .default(sql`timezone('utc'::text, now())::date`)
      .notNull(),
    note: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_time_logs_project')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_time_logs_user_id')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'time_logs_project_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'time_logs_user_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('Admins manage time logs', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`is_admin()`,
      withCheck: sql`is_admin()`,
    }),
    pgPolicy('Users update time logs', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
    }),
    pgPolicy('Users view time logs', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
    check('time_logs_hours_check', sql`hours > (0)::numeric`),
  ]
)

export const timeLogTasks = pgTable(
  'time_log_tasks',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    timeLogId: uuid('time_log_id').notNull(),
    taskId: uuid('task_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_time_log_tasks_task_id')
      .using('btree', table.taskId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    uniqueIndex('idx_time_log_tasks_unique')
      .using(
        'btree',
        table.timeLogId.asc().nullsLast().op('uuid_ops'),
        table.taskId.asc().nullsLast().op('uuid_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.timeLogId],
      foreignColumns: [timeLogs.id],
      name: 'time_log_tasks_time_log_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'time_log_tasks_task_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('Admins manage time log tasks', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`is_admin()`,
      withCheck: sql`is_admin()`,
    }),
    pgPolicy('Users view time log tasks', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
    check(
      'time_log_tasks_project_match',
      sql`CHECK (time_log_task_matches_project(time_log_id, task_id))`
    ),
  ]
)

export const taskAttachments = pgTable(
  'task_attachments',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    taskId: uuid('task_id').notNull(),
    storagePath: text('storage_path').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    uploadedBy: uuid('uploaded_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_task_attachments_task')
      .using('btree', table.taskId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_task_attachments_uploaded_by')
      .using('btree', table.uploadedBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: 'task_attachments_task_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.uploadedBy],
      foreignColumns: [users.id],
      name: 'task_attachments_uploaded_by_fkey',
    }).onDelete('cascade'),
    pgPolicy('Admins manage task attachments', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`is_admin()`,
      withCheck: sql`is_admin()`,
    }),
    pgPolicy('Users create task attachments', {
      as: 'permissive',
      for: 'insert',
      to: ['public'],
    }),
    pgPolicy('Users view task attachments', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
  ]
)

export const activityOverviewCache = pgTable(
  'activity_overview_cache',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    timeframeDays: smallint('timeframe_days').notNull(),
    summary: text().notNull(),
    cachedAt: timestamp('cached_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
  },
  table => [
    uniqueIndex('activity_overview_cache_user_timeframe_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.timeframeDays.asc().nullsLast().op('int2_ops')
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'activity_overview_cache_user_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('Users can delete their cached activity overview', {
      as: 'permissive',
      for: 'delete',
      to: ['public'],
      using: sql`(( SELECT auth.uid() AS uid) = user_id)`,
    }),
    pgPolicy('Users can insert their cached activity overview', {
      as: 'permissive',
      for: 'insert',
      to: ['public'],
    }),
    pgPolicy('Users can update their cached activity overview', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
    }),
    pgPolicy('Users can view their cached activity overview', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
    check(
      'activity_overview_cache_timeframe_days_check',
      sql`timeframe_days = ANY (ARRAY[1, 7, 14, 28])`
    ),
  ]
)

export const tasks = pgTable(
  'tasks',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    projectId: uuid('project_id').notNull(),
    title: text().notNull(),
    description: text(),
    status: taskStatus().default('BACKLOG').notNull(),
    dueOn: date('due_on'),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    acceptedAt: timestamp('accepted_at', {
      withTimezone: true,
      mode: 'string',
    }),
    rank: text().default('zzzzzzzz').notNull(),
  },
  table => [
    index('idx_tasks_created_by')
      .using('btree', table.createdBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_tasks_project')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_tasks_project_status_rank').using(
      'btree',
      table.projectId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('enum_ops'),
      table.rank.asc().nullsLast().op('text_ops')
    ),
    index('idx_tasks_status')
      .using('btree', table.status.asc().nullsLast().op('enum_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_tasks_updated_by')
      .using('btree', table.updatedBy.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'tasks_project_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.createdBy],
      foreignColumns: [users.id],
      name: 'tasks_created_by_fkey',
    }),
    foreignKey({
      columns: [table.updatedBy],
      foreignColumns: [users.id],
      name: 'tasks_updated_by_fkey',
    }),
    pgPolicy('Users create tasks', {
      as: 'permissive',
      for: 'insert',
      to: ['public'],
      withCheck: sql`is_admin()`,
    }),
    pgPolicy('Users delete tasks', {
      as: 'permissive',
      for: 'delete',
      to: ['public'],
    }),
    pgPolicy('Users update tasks', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
    }),
    pgPolicy('Users view tasks', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
  ]
)

export const leads = pgTable(
  'leads',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    contactName: text('contact_name').notNull(),
    status: leadStatus().default('NEW_OPPORTUNITIES').notNull(),
    sourceType: leadSourceType('source_type'),
    sourceDetail: text('source_detail'),
    assigneeId: uuid('assignee_id'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    companyName: text('company_name'),
    companyWebsite: text('company_website'),
    notes: jsonb('notes').default({}).notNull(),
    rank: text().default('zzzzzzzz').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    index('idx_leads_status')
      .using('btree', table.status.asc().nullsLast().op('enum_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_leads_assignee')
      .using('btree', table.assigneeId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.assigneeId],
      foreignColumns: [users.id],
      name: 'leads_assignee_id_fkey',
    }),
    pgPolicy('Admins manage leads', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`is_admin()`,
      withCheck: sql`is_admin()`,
    }),
    pgPolicy('Users view leads', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
  ]
)

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull(),
    fullName: text('full_name'),
    role: userRole().default('CLIENT').notNull(),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [table.id],
      name: 'users_id_fkey',
    }).onDelete('cascade'),
    unique('users_email_key').on(table.email),
    pgPolicy('Admins delete users', {
      as: 'permissive',
      for: 'delete',
      to: ['public'],
      using: sql`is_admin()`,
    }),
    pgPolicy('Admins insert users', {
      as: 'permissive',
      for: 'insert',
      to: ['public'],
    }),
    pgPolicy('Admins update users', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
    }),
    pgPolicy('Users view accessible users', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
  ]
)

export const oauthConnections = pgTable(
  'oauth_connections',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    provider: oauthProvider().notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token').notNull(), // Encrypted
    refreshToken: text('refresh_token'), // Encrypted, nullable
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'string',
    }),
    scopes: text('scopes').array().notNull(),
    status: oauthConnectionStatus().default('ACTIVE').notNull(),
    providerEmail: text('provider_email'),
    providerMetadata: jsonb('provider_metadata').default({}).notNull(),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // One connection per user per provider
    unique('oauth_connections_user_provider_key').on(table.userId, table.provider),
    // Index for looking up user's connections
    index('idx_oauth_connections_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // Index for finding connections by provider
    index('idx_oauth_connections_provider')
      .using('btree', table.provider.asc().nullsLast())
      .where(sql`(deleted_at IS NULL AND status = 'ACTIVE')`),
    // Foreign key to users
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'oauth_connections_user_id_fkey',
    }).onDelete('cascade'),
    // RLS Policies
    pgPolicy('Users manage own oauth connections', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`user_id = auth.uid()`,
    }),
    pgPolicy('Admins view all oauth connections', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
      using: sql`is_admin()`,
    }),
  ]
)

// Email linking foundation
export const emailLinkSource = pgEnum('email_link_source', [
  'AUTOMATIC',
  'MANUAL_FORWARD',
  'MANUAL_LINK',
])

export const emailMetadata = pgTable(
  'email_metadata',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(), // PTS user who owns this email
    gmailMessageId: text('gmail_message_id').notNull(),
    gmailThreadId: text('gmail_thread_id'),
    subject: text(),
    snippet: text(), // Gmail preview text
    fromEmail: text('from_email').notNull(),
    fromName: text('from_name'),
    toEmails: text('to_emails').array().default([]).notNull(),
    ccEmails: text('cc_emails').array().default([]).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'string' }).notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    hasAttachments: boolean('has_attachments').default(false).notNull(),
    labels: text().array().default([]).notNull(),
    rawMetadata: jsonb('raw_metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // Unique: one entry per Gmail message per user
    unique('email_metadata_user_gmail_id_key').on(table.userId, table.gmailMessageId),
    // Index for user's emails
    index('idx_email_metadata_user')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // Index for from email (for matching)
    index('idx_email_metadata_from_email')
      .using('btree', table.fromEmail.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // Index for date range queries
    index('idx_email_metadata_received_at')
      .using('btree', table.receivedAt.desc().nullsFirst())
      .where(sql`(deleted_at IS NULL)`),
    // Index for thread grouping
    index('idx_email_metadata_thread')
      .using('btree', table.gmailThreadId.asc().nullsLast().op('text_ops'))
      .where(sql`(deleted_at IS NULL AND gmail_thread_id IS NOT NULL)`),
    // Foreign key
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'email_metadata_user_id_fkey',
    }).onDelete('cascade'),
    // RLS Policies
    pgPolicy('Users manage own email metadata', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`user_id = auth.uid()`,
      withCheck: sql`user_id = auth.uid()`,
    }),
    pgPolicy('Admins view all email metadata', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
      using: sql`is_admin()`,
    }),
  ]
)

export const emailLinks = pgTable(
  'email_links',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    emailMetadataId: uuid('email_metadata_id').notNull(),
    clientId: uuid('client_id'), // Nullable - can link to just project
    projectId: uuid('project_id'), // Nullable - can link to just client
    source: emailLinkSource().notNull(),
    confidence: numeric({ precision: 3, scale: 2 }), // 0.00-1.00
    linkedBy: uuid('linked_by'), // Null for automatic links
    notes: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => [
    // Index for email lookup
    index('idx_email_links_email')
      .using('btree', table.emailMetadataId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    // Index for client lookup
    index('idx_email_links_client')
      .using('btree', table.clientId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND client_id IS NOT NULL)`),
    // Index for project lookup
    index('idx_email_links_project')
      .using('btree', table.projectId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL AND project_id IS NOT NULL)`),
    // Constraint: must link to at least client OR project
    check(
      'email_links_client_or_project',
      sql`client_id IS NOT NULL OR project_id IS NOT NULL`
    ),
    // Constraint: confidence must be between 0 and 1
    check(
      'email_links_confidence_range',
      sql`confidence IS NULL OR (confidence >= 0 AND confidence <= 1)`
    ),
    // Foreign keys
    foreignKey({
      columns: [table.emailMetadataId],
      foreignColumns: [emailMetadata.id],
      name: 'email_links_email_metadata_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [clients.id],
      name: 'email_links_client_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
      name: 'email_links_project_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.linkedBy],
      foreignColumns: [users.id],
      name: 'email_links_linked_by_fkey',
    }),
    // RLS Policies
    pgPolicy('Admins manage email links', {
      as: 'permissive',
      for: 'all',
      to: ['public'],
      using: sql`is_admin()`,
      withCheck: sql`is_admin()`,
    }),
    pgPolicy('Users view linked emails for accessible clients', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
      using: sql`(
        client_id IN (
          SELECT client_id FROM client_members
          WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        OR project_id IN (
          SELECT id FROM projects
          WHERE created_by = auth.uid() AND deleted_at IS NULL
        )
      )`,
    }),
  ]
)

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    actorId: uuid('actor_id').notNull(),
    actorRole: userRole('actor_role').notNull(),
    verb: text().notNull(),
    summary: text().notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id'),
    targetClientId: uuid('target_client_id'),
    targetProjectId: uuid('target_project_id'),
    contextRoute: text('context_route'),
    metadata: jsonb().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .default(sql`timezone('utc'::text, now())`)
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    restoredAt: timestamp('restored_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  table => [
    index('idx_activity_logs_actor_id')
      .using('btree', table.actorId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(deleted_at IS NULL)`),
    index('idx_activity_logs_client')
      .using(
        'btree',
        table.targetClientId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsFirst().op('timestamptz_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    index('idx_activity_logs_created_at').using(
      'btree',
      table.createdAt.desc().nullsFirst().op('timestamptz_ops')
    ),
    index('idx_activity_logs_project')
      .using(
        'btree',
        table.targetProjectId.asc().nullsLast().op('uuid_ops'),
        table.createdAt.desc().nullsFirst().op('timestamptz_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    index('idx_activity_logs_target')
      .using(
        'btree',
        table.targetType.asc().nullsLast().op('text_ops'),
        table.targetId.asc().nullsLast().op('uuid_ops')
      )
      .where(sql`(deleted_at IS NULL)`),
    foreignKey({
      columns: [table.actorId],
      foreignColumns: [users.id],
      name: 'activity_logs_actor_id_fkey',
    }).onDelete('cascade'),
    pgPolicy('Admins delete activity logs', {
      as: 'permissive',
      for: 'delete',
      to: ['public'],
      using: sql`is_admin()`,
    }),
    pgPolicy('Admins update activity logs', {
      as: 'permissive',
      for: 'update',
      to: ['public'],
    }),
    pgPolicy('Users insert activity logs', {
      as: 'permissive',
      for: 'insert',
      to: ['public'],
    }),
    pgPolicy('Users view activity logs', {
      as: 'permissive',
      for: 'select',
      to: ['public'],
    }),
  ]
)
export const currentUserWithRole = pgView('current_user_with_role', {
  id: uuid(),
  role: userRole(),
}).as(
  sql`SELECT id, role FROM users u WHERE id = auth.uid() AND deleted_at IS NULL`
)
