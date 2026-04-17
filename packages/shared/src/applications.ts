import { z } from 'zod';
import { StageSchema } from './stages.js';

export const ApplicationSchema = z.object({
  id: z.number().int().positive(),
  companyId: z.number().int().positive(),
  companyName: z.string().optional(), // joined
  role: z.string().min(1),
  stage: StageSchema,
  url: z.string().url().nullable(),
  notes: z.string().nullable(),
  appliedAt: z.string().datetime({ offset: true }).nullable(),
  lastActivityAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type Application = z.infer<typeof ApplicationSchema>;

export const CreateApplicationSchema = ApplicationSchema.omit({
  id: true,
  companyName: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateApplication = z.infer<typeof CreateApplicationSchema>;

export const UpdateApplicationSchema = z.object({
  stage: StageSchema.optional(),
  role: z.string().min(1).optional(),
  url: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type UpdateApplication = z.infer<typeof UpdateApplicationSchema>;

export const ApplicationListResponseSchema = z.object({
  items: z.array(ApplicationSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type ApplicationListResponse = z.infer<typeof ApplicationListResponseSchema>;

/** Stage transition event, recorded per change */
export const StageEventSchema = z.object({
  id: z.number().int().positive(),
  applicationId: z.number().int().positive(),
  fromStage: StageSchema.nullable(),
  toStage: StageSchema,
  occurredAt: z.string().datetime({ offset: true }),
  notes: z.string().nullable(),
});

export type StageEvent = z.infer<typeof StageEventSchema>;
