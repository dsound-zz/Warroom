import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { ingesterRuns, signals } from '../db/schema.js';
import { logger } from '../logger.js';
import { resolveOrCreateCompany } from '../services/companyResolver.js';

export interface RawSignal {
  source: string;
  sourceUrl: string;
  title: string;
  snippet: string | null;
  companyNameHint: string | null;
  domainHint?: string | null;
  publishedAt: Date | null;
  rawPayload?: Record<string, unknown>;
}

export abstract class BaseIngester {
  abstract readonly sourceName: string;

  /**
   * Fetch raw signals from the source.
   * Implementations must NOT catch errors — they propagate to run().
   */
  protected abstract fetch(): Promise<RawSignal[]>;

  async run(): Promise<{ seen: number; created: number }> {
    const startedAt = new Date();
    const log = logger.child({ ingester: this.sourceName });

    const [runRow] = await db
      .insert(ingesterRuns)
      .values({ source: this.sourceName, startedAt, status: 'running' })
      .returning({ id: ingesterRuns.id });

    if (!runRow) throw new Error('Failed to insert ingester_run row');
    const runId = runRow.id;

    let seen = 0;
    let created = 0;

    try {
      const raw = await this.fetch();
      seen = raw.length;
      log.info({ seen }, 'fetched raw signals');

      for (const item of raw) {
        const companyId = await resolveOrCreateCompany(db, item.companyNameHint, item.domainHint);

        // Skip if already ingested by sourceUrl
        const existing = await db.query.signals.findFirst({
          where: (s, { eq: eqFn }) => eqFn(s.sourceUrl, item.sourceUrl),
          columns: { id: true },
        });

        if (existing) continue;

        await db.insert(signals).values({
          source: item.source,
          sourceUrl: item.sourceUrl,
          title: item.title,
          snippet: item.snippet,
          companyNameHint: item.companyNameHint,
          companyId,
          publishedAt: item.publishedAt,
          rawPayload: item.rawPayload ?? {},
        });

        created++;
      }

      await db
        .update(ingesterRuns)
        .set({
          finishedAt: new Date(),
          status: 'success',
          signalsSeen: seen,
          signalsNew: created,
        })
        .where(eq(ingesterRuns.id, runId));

      log.info({ seen, created }, 'ingester finished successfully');
      return { seen, created };
    } catch (err) {
      const errorText = err instanceof Error ? err.message : String(err);
      log.error({ err }, 'ingester failed');

      await db
        .update(ingesterRuns)
        .set({
          finishedAt: new Date(),
          status: 'error',
          signalsSeen: seen,
          signalsNew: created,
          errorText,
        })
        .where(eq(ingesterRuns.id, runId));

      throw err; // re-throw so scheduler / CLI sees the failure
    }
  }
}
