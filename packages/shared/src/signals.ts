import { z } from 'zod';
import { CompanyBriefSchema } from './companies.js';

export const SIGNAL_ACTION_TYPES = [
  'saved',
  'emailed',
  'applied',
  'reached_out',
  'scheduled_interview',
  'not_relevant',
  'dead_link',
] as const;
export type SignalActionType = typeof SIGNAL_ACTION_TYPES[number];
export const SignalActionTypeSchema = z.enum(SIGNAL_ACTION_TYPES);

export const SIGNAL_ACTION_LABELS: Record<SignalActionType, string> = {
  saved: 'Saved for later',
  emailed: 'Emailed contact',
  applied: 'Applied',
  reached_out: 'Reached out (LinkedIn, etc.)',
  scheduled_interview: 'Scheduled interview',
  not_relevant: 'Not relevant',
  dead_link: 'Dead link',
};

export const SignalActionSchema = z.object({
  id: z.number().int(),
  signalId: z.number().int(),
  actionType: SignalActionTypeSchema,
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type SignalAction = z.infer<typeof SignalActionSchema>;

export const CreateSignalActionSchema = z.object({
  actionType: SignalActionTypeSchema,
  note: z.string().nullable().optional(),
});
export type CreateSignalAction = z.infer<typeof CreateSignalActionSchema>;

export const SignalSchema = z.object({
  id: z.number().int(),
  source: z.string(),
  signalType: z.string(),
  title: z.string().nullable(),
  url: z.string().nullable(),
  extractedSummary: z.string().nullable(),
  score: z.number().nullable(),
  detectedAt: z.string(),
  actedOn: z.boolean(),
  dismissed: z.boolean(),
  company: CompanyBriefSchema.nullable(),
  isDna: z.boolean().default(false),
  actions: z.array(SignalActionSchema).default([]),
});
export type Signal = z.infer<typeof SignalSchema>;

export const SignalsListQuerySchema = z.object({
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  includeDismissed: z.coerce.boolean().default(false),
  includeActed: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type SignalsListQuery = z.infer<typeof SignalsListQuerySchema>;

export const SignalsListResponseSchema = z.object({
  items: z.array(SignalSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type SignalsListResponse = z.infer<typeof SignalsListResponseSchema>;
