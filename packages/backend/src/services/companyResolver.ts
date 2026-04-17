import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { companies } from '../db/schema.js';
import { logger } from '../logger.js';

/**
 * Normalize a company name hint for deduplication:
 * 1. Lowercase
 * 2. Strip legal suffixes (inc, llc, ltd, corp, co, gmbh)
 * 3. Strip URL prefixes (https://, www.)
 * 4. Strip leading/trailing whitespace and trailing punctuation
 */
function normalizeHint(hint: string): string {
  return hint
    .toLowerCase()
    .replace(/https?:\/\/|www\./gi, '')
    .replace(/\b(inc|llc|ltd|corp|co|gmbh)\b\.?/gi, '')
    .trim()
    .replace(/[.,;:'"!?/]+$/g, '')
    .trim();
}

/**
 * Find or create a company from a name hint.
 * Returns null if the hint is null/empty after normalization.
 * Never merges silently — duplicate detection is a manual review task.
 */
export async function resolveOrCreateCompany(
  db: Database,
  nameHint: string | null | undefined,
  domainHint?: string | null,
): Promise<number | null> {
  if (!nameHint) return null;

  const normalized = normalizeHint(nameHint);
  if (!normalized) return null;

  try {
    // 1. Look up by normalized name
    const [existing] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.normalizedName, normalized))
      .limit(1);

    if (existing) return existing.id;

    // 2. Create new company
    const [created] = await db
      .insert(companies)
      .values({
        name: nameHint.trim(),
        normalizedName: normalized,
        domain: domainHint ?? null,
      })
      .returning({ id: companies.id });

    if (!created) throw new Error('Insert returned no rows');

    logger.info({ normalizedName: normalized, id: created.id }, 'created new company');
    return created.id;
  } catch (err) {
    logger.error({ err, nameHint }, 'resolveOrCreateCompany error');
    return null;
  }
}
