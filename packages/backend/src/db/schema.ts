import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  real,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// companies
// ---------------------------------------------------------------------------
export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull().unique(),
  domain: text('domain'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// signals
// ---------------------------------------------------------------------------
export const signals = pgTable('signals', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  sourceUrl: text('source_url').notNull(),
  title: text('title').notNull(),
  snippet: text('snippet'),
  companyNameHint: text('company_name_hint'),
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  actedOn: boolean('acted_on').notNull().default(false),
  dismissed: boolean('dismissed').notNull().default(false),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull().default({}),
  // Phase 3 fields — nullable for now
  relevanceScore: real('relevance_score'),
  tags: text('tags').array(),
});

// ---------------------------------------------------------------------------
// signal_actions
// ---------------------------------------------------------------------------
export const signalActions = pgTable('signal_actions', {
  id: serial('id').primaryKey(),
  signalId: integer('signal_id')
    .notNull()
    .references(() => signals.id, { onDelete: 'cascade' }),
  actionType: text('action_type').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// applications
// ---------------------------------------------------------------------------
export const applications = pgTable('applications', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'restrict' }),
  role: text('role').notNull(),
  stage: text('stage').notNull(), // validated at app layer via StageSchema
  url: text('url'),
  notes: text('notes'),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// stage_events
// ---------------------------------------------------------------------------
export const stageEvents = pgTable('stage_events', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id')
    .notNull()
    .references(() => applications.id, { onDelete: 'cascade' }),
  fromStage: text('from_stage'), // null on creation
  toStage: text('to_stage').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
});

// ---------------------------------------------------------------------------
// ingester_runs
// ---------------------------------------------------------------------------
export const ingesterRuns = pgTable('ingester_runs', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull(), // 'running' | 'success' | 'error'
  signalsSeen: integer('signals_seen').default(0),
  signalsNew: integer('signals_new').default(0),
  errorText: text('error_text'),
});

// ---------------------------------------------------------------------------
// dna (professional DNA — experience units for Phase 3 matching)
// ---------------------------------------------------------------------------
export const dna = pgTable('dna', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(), // 'role' | 'skill' | 'achievement' | 'education'
  content: text('content').notNull(),
  meta: jsonb('meta').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// do_not_apply
// ---------------------------------------------------------------------------
export const doNotApply = pgTable('do_not_apply', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' })
    .unique(),
  reasonCategory: text('reason_category').notNull(),
  reasonNotes: text('reason_notes'),
  blockType: text('block_type').notNull().default('hard'),
  reconsiderAt: timestamp('reconsider_at', { withTimezone: true }),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// contacts
// ---------------------------------------------------------------------------
export const contacts = pgTable('contacts', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  title: text('title'),
  linkedinUrl: text('linkedin_url'),
  email: text('email'),
  twitterHandle: text('twitter_handle'),
  relationship: text('relationship').notNull().default('cold'),
  lastTouchedAt: timestamp('last_touched_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// interview_notes
// ---------------------------------------------------------------------------
export const interviewNotes = pgTable('interview_notes', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id')
    .notNull()
    .references(() => applications.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  prepNotes: text('prep_notes'),
  postMortem: text('post_mortem'),
  whatWentWell: text('what_went_well'),
  whatWentPoorly: text('what_went_poorly'),
  lessons: text('lessons'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const companiesRelations = relations(companies, ({ many }) => ({
  signals: many(signals),
  applications: many(applications),
  doNotApply: many(doNotApply),
  contacts: many(contacts),
}));

export const signalsRelations = relations(signals, ({ one, many }) => ({
  company: one(companies, {
    fields: [signals.companyId],
    references: [companies.id],
  }),
  actions: many(signalActions),
}));

export const signalActionsRelations = relations(signalActions, ({ one }) => ({
  signal: one(signals, {
    fields: [signalActions.signalId],
    references: [signals.id],
  }),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  company: one(companies, {
    fields: [applications.companyId],
    references: [companies.id],
  }),
  stageEvents: many(stageEvents),
  interviewNotes: many(interviewNotes),
}));

export const stageEventsRelations = relations(stageEvents, ({ one }) => ({
  application: one(applications, {
    fields: [stageEvents.applicationId],
    references: [applications.id],
  }),
}));

export const doNotApplyRelations = relations(doNotApply, ({ one }) => ({
  company: one(companies, {
    fields: [doNotApply.companyId],
    references: [companies.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
}));

export const interviewNotesRelations = relations(interviewNotes, ({ one }) => ({
  application: one(applications, {
    fields: [interviewNotes.applicationId],
    references: [applications.id],
  }),
}));

