import { z } from 'zod';
import { CompanyBriefSchema } from './companies.js';

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
});
export type Signal = z.infer<typeof SignalSchema>;

export const SignalsListQuerySchema = z.object({
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  source: z.string().optional(),
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
