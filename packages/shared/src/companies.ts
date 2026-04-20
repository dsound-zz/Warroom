import { z } from 'zod';

export const CompanyBriefSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});
export type CompanyBrief = z.infer<typeof CompanyBriefSchema>;

export const CompanySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  domain: z.string().nullable(),
  /** Free-form notes about the company */
  notes: z.string().nullable(),
  /** Phase 3: embedding vector stored in pgvector — not exposed via API in Phase 1 */
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type Company = z.infer<typeof CompanySchema>;

export const CreateCompanySchema = CompanySchema.omit({
  id: true,
  normalizedName: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateCompany = z.infer<typeof CreateCompanySchema>;

export const CompanyListResponseSchema = z.object({
  items: z.array(CompanySchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type CompanyListResponse = z.infer<typeof CompanyListResponseSchema>;
