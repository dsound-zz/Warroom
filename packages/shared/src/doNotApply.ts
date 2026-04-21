import { z } from 'zod';
import { CompanyBriefSchema } from './companies.js';

export const DNA_REASON_CATEGORIES = [
  'bad_interview',
  'ghosted',
  'wrong_stack',
  'wrong_stage',
  'ethical_concerns',
  'already_rejected',
  'hiring_freeze',
  'other',
] as const;
export type DnaReasonCategory = typeof DNA_REASON_CATEGORIES[number];
export const DnaReasonCategorySchema = z.enum(DNA_REASON_CATEGORIES);

export const BLOCK_TYPES = ['hard', 'soft'] as const;
export type BlockType = typeof BLOCK_TYPES[number];
export const BlockTypeSchema = z.enum(BLOCK_TYPES);

export const DoNotApplySchema = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  company: CompanyBriefSchema.optional(),
  reasonCategory: DnaReasonCategorySchema,
  reasonNotes: z.string().nullable(),
  blockType: BlockTypeSchema,
  reconsiderAt: z.string().nullable(),
  addedAt: z.string(),
});
export type DoNotApply = z.infer<typeof DoNotApplySchema>;

export const CreateDoNotApplySchema = z.object({
  companyId: z.number().int(),
  reasonCategory: DnaReasonCategorySchema,
  reasonNotes: z.string().nullable().optional(),
  blockType: BlockTypeSchema.default('hard'),
  reconsiderAt: z.string().datetime().nullable().optional(),
});
export type CreateDoNotApply = z.infer<typeof CreateDoNotApplySchema>;

export const QuickAddDoNotApplySchema = z.object({
  domain: z.string().min(1),
  reasonCategory: DnaReasonCategorySchema.default('other'),
  sourceUrl: z.string().optional(),
});
export type QuickAddDoNotApply = z.infer<typeof QuickAddDoNotApplySchema>;
