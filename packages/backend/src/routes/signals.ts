import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { signals } from '../db/schema.js';
import { logger } from '../logger.js';
import { DEFAULT_LIMIT, MAX_LIMIT } from '@warroom/shared';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
  since: z.string().datetime({ offset: true }).optional(),
  until: z.string().datetime({ offset: true }).optional(),
  companyId: z.coerce.number().int().positive().optional(),
});

export const signalsRouter = new Hono();

signalsRouter.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { limit, offset, since, until, companyId } = c.req.valid('query');

  try {
    const conditions: Parameters<typeof db.select>[0] extends undefined
      ? never
      // We build conditions inline below
      : unknown[] = [];

    const rows = await db
      .select()
      .from(signals)
      .where(
        sql`${companyId !== undefined ? sql`${signals.companyId} = ${companyId} AND ` : sql``}
            ${since !== undefined ? sql`${signals.ingestedAt} >= ${new Date(since)} AND ` : sql``}
            ${until !== undefined ? sql`${signals.ingestedAt} <= ${new Date(until)} AND ` : sql``}
            TRUE`,
      )
      .orderBy(desc(signals.ingestedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(signals)
      .where(
        sql`${companyId !== undefined ? sql`${signals.companyId} = ${companyId} AND ` : sql``}
            ${since !== undefined ? sql`${signals.ingestedAt} >= ${new Date(since)} AND ` : sql``}
            ${until !== undefined ? sql`${signals.ingestedAt} <= ${new Date(until)} AND ` : sql``}
            TRUE`,
      );

    return c.json({
      items: rows,
      total: countRow?.count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    logger.error({ err }, 'signals list error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

signalsRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) {
    throw new HTTPException(400, { message: 'Invalid id' });
  }

  try {
    const [row] = await db.select().from(signals).where(eq(signals.id, id)).limit(1);
    if (!row) throw new HTTPException(404, { message: 'Signal not found' });
    return c.json(row);
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, 'signals get error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});
