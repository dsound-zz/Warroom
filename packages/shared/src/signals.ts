import { z } from 'zod';
import { CompanyBriefSchema } from './companies.js';

export const SIGNAL_STATUS_TAGS = [
  'applied',
  'contacted',
  'wrong_stack',
  'dead_link',
  'dna',
  'ignored',
  'saved',
  'interviewing',
  'not_relevant',
] as const;
export type SignalStatusTag = typeof SIGNAL_STATUS_TAGS[number];
export const SignalStatusTagSchema = z.enum(SIGNAL_STATUS_TAGS);

export const SIGNAL_STATUS_LABELS: Record<SignalStatusTag, string> = {
  applied: 'Applied',
  contacted: 'Contacted',
  wrong_stack: 'Wrong stack',
  dead_link: 'Dead link',
  dna: 'Add to DNA',
  ignored: 'Ignored',
  saved: 'Saved',
  interviewing: 'Interviewing',
  not_relevant: 'Not relevant',
};

export const SignalContactSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['email', 'linkedin', 'twitter', 'other']).default('email'),
  detail: z.string().optional(),
});
export type SignalContact = z.infer<typeof SignalContactSchema>;

export const SignalActionSchema = z.object({
  id: z.number().int(),
  signalId: z.number().int(),
  statusTags: z.array(SignalStatusTagSchema),
  contact: SignalContactSchema.nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type SignalAction = z.infer<typeof SignalActionSchema>;

export const CreateSignalActionSchema = z.object({
  statusTags: z.array(SignalStatusTagSchema).min(1),
  contact: SignalContactSchema.nullable().optional(),
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
  latestAction: SignalActionSchema.nullable().default(null),
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
