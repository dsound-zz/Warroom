import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, gte, lte, desc, sql, inArray, or, ilike } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/index.js';
import { signals, companies, doNotApply, signalActions } from '../db/schema.js';
import { logger } from '../logger.js';
import {
  SignalsListQuerySchema,
  CreateSignalActionSchema,
  type Signal,
  type SignalAction,
} from '@warroom/shared';

export const signalsRouter = new Hono();

const COLS = {
  id: signals.id,
  source: signals.source,
  sourceUrl: signals.sourceUrl,
  title: signals.title,
  snippet: signals.snippet,
  ingestedAt: signals.ingestedAt,
  relevanceScore: signals.relevanceScore,
  actedOn: signals.actedOn,
  dismissed: signals.dismissed,
  companyId: signals.companyId,
  companyName: companies.name,
  companyDbId: companies.id,
};

type Row = typeof COLS extends Record<string, unknown>
  ? {
      id: number;
      source: string;
      sourceUrl: string;
      title: string;
      snippet: string | null;
      ingestedAt: Date;
      relevanceScore: number | null;
      actedOn: boolean;
      dismissed: boolean;
      companyId: number | null;
      companyName: string | null;
      companyDbId: number | null;
    }
  : never;

function mapRow(row: Row, isDna = false): Signal {
  return {
    id: row.id,
    source: row.source,
    signalType: row.source,
    title: row.title,
    url: row.sourceUrl,
    extractedSummary: row.snippet,
    score: row.relevanceScore ?? null,
    detectedAt: row.ingestedAt.toISOString(),
    actedOn: row.actedOn,
    dismissed: row.dismissed,
    company:
      row.companyDbId !== null && row.companyName !== null
        ? { id: row.companyDbId, name: row.companyName }
        : null,
    isDna,
    actions: [], // Filled correctly below
  };
}

function mapAction(row: typeof signalActions.$inferSelect): SignalAction {
  return {
    id: row.id,
    signalId: row.signalId,
    actionType: row.actionType as SignalAction['actionType'],
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getSignalById(id: number): Promise<Signal> {
  const rows = await db
    .select(COLS)
    .from(signals)
    .leftJoin(companies, eq(signals.companyId, companies.id))
    .where(eq(signals.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new HTTPException(404, { message: 'Signal not found' });
  const signal = mapRow(row as Row);

  const actionsResult = await db.select().from(signalActions).where(eq(signalActions.signalId, id)).orderBy(desc(signalActions.createdAt));
  signal.actions = actionsResult.map(mapAction);

  return signal;
}

function buildSearchFilter(search: string) {
  const terms = search.split(/ OR /i).map((t) => t.trim()).filter(Boolean);
  return or(
    ...terms.flatMap((term) => [
      ilike(signals.title, `%${term}%`),
      ilike(signals.snippet, `%${term}%`),
      ilike(companies.name, `%${term}%`),
    ]),
  );
}

signalsRouter.get('/', zValidator('query', SignalsListQuerySchema), async (c) => {
  const q = c.req.valid('query');

  const now = new Date();
  const sinceDate = q.since ? new Date(q.since) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const untilDate = q.until ? new Date(q.until) : now;

  const where = and(
    gte(signals.ingestedAt, sinceDate),
    lte(signals.ingestedAt, untilDate),
    q.source !== undefined ? eq(signals.source, q.source) : undefined,
    !q.includeActed ? eq(signals.actedOn, false) : undefined,
    !q.includeDismissed ? eq(signals.dismissed, false) : undefined,
    q.search ? buildSearchFilter(q.search) : undefined,
  );

  try {
    const rows = await db
      .select(COLS)
      .from(signals)
      .leftJoin(companies, eq(signals.companyId, companies.id))
      .where(where)
      .orderBy(desc(signals.ingestedAt))
      .limit(q.limit)
      .offset(q.offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(signals)
      .leftJoin(companies, eq(signals.companyId, companies.id))
      .where(where);

    // Build DNA set for enrichment
    const companyIds = [
      ...new Set(
        rows.map((r) => (r as Row).companyId).filter((id): id is number => id !== null),
      ),
    ];
    let dnaSet = new Set<number>();
    if (companyIds.length > 0) {
      const dnaRows = await db
        .select({ companyId: doNotApply.companyId })
        .from(doNotApply)
        .where(inArray(doNotApply.companyId, companyIds));
      dnaSet = new Set(dnaRows.map((r) => r.companyId));
    }

    const signalIds = rows.map((r) => (r as Row).id);
    let actionsBySignalId: Record<number, SignalAction[]> = {};

    if (signalIds.length > 0) {
      const actionsRows = await db
        .select()
        .from(signalActions)
        .where(inArray(signalActions.signalId, signalIds))
        .orderBy(desc(signalActions.createdAt));

      for (const ar of actionsRows) {
        if (ar.signalId !== null) {
          if (!actionsBySignalId[ar.signalId]) {
            actionsBySignalId[ar.signalId] = [];
          }
          actionsBySignalId[ar.signalId]!.push(mapAction(ar));
        }
      }
    }

    return c.json({
      items: rows.map((r) => {
        const typed = r as Row;
        const mapped = mapRow(typed, typed.companyId !== null && dnaSet.has(typed.companyId));
        mapped.actions = actionsBySignalId[mapped.id] || [];
        return mapped;
      }),
      total: countRow?.count ?? 0,
      limit: q.limit,
      offset: q.offset,
    });
  } catch (err) {
    logger.error({ err }, 'signals list error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

signalsRouter.post(
  '/:id/action',
  zValidator('json', CreateSignalActionSchema),
  async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id < 1) return c.json({ error: 'Invalid id' }, 400);

    const body = c.req.valid('json');

    try {
      await db.transaction(async (tx) => {
        await tx.insert(signalActions).values({
          signalId: id,
          actionType: body.actionType,
          note: body.note ?? null,
        });
        await tx
          .update(signals)
          .set({ actedOn: true })
          .where(eq(signals.id, id));
      });

      return c.json(await getSignalById(id));
    } catch (err) {
      logger.error({ err }, 'signals action error');
      throw new HTTPException(500, { message: 'Internal server error' });
    }
  },
);

signalsRouter.post('/:id/act', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) return c.json({ error: 'Invalid id' }, 400);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(signalActions).values({
        signalId: id,
        actionType: 'saved',
        note: null,
      });
      await tx
        .update(signals)
        .set({ actedOn: true })
        .where(eq(signals.id, id));
    });

    return c.json(await getSignalById(id));
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, 'signals act error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

signalsRouter.post('/:id/dismiss', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) return c.json({ error: 'Invalid id' }, 400);

  try {
    const updated = await db
      .update(signals)
      .set({ dismissed: true })
      .where(eq(signals.id, id))
      .returning({ id: signals.id });

    if (updated.length === 0) return c.json({ error: 'Not found' }, 404);
    return c.json(await getSignalById(id));
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, 'signals dismiss error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

