import { z } from 'zod';

export const SignalSchema = z.object({
  id: z.number().int().positive(),
  source: z.string().min(1),
  sourceUrl: z.string().url(),
  title: z.string().min(1),
  snippet: z.string().nullable(),
  companyNameHint: z.string().nullable(),
  companyId: z.number().int().positive().nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  ingestedAt: z.string().datetime({ offset: true }),
  /** Phase 3: LLM-assigned relevance score 0..1 */
  relevanceScore: z.number().min(0).max(1).nullable(),
  /** Phase 3: structured tags extracted by LLM */
  tags: z.array(z.string()).nullable(),
});

export type Signal = z.infer<typeof SignalSchema>;

export const CreateSignalSchema = SignalSchema.omit({
  id: true,
  ingestedAt: true,
  relevanceScore: true,
  tags: true,
  companyId: true,
}).extend({
  companyNameHint: z.string().nullable().optional(),
});

export type CreateSignal = z.infer<typeof CreateSignalSchema>;

export const SignalListResponseSchema = z.object({
  items: z.array(SignalSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type SignalListResponse = z.infer<typeof SignalListResponseSchema>;
