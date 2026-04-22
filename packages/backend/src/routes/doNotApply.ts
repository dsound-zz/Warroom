import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, or, isNull, gt, desc, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/index.js';
import { doNotApply, companies } from '../db/schema.js';
import { logger } from '../logger.js';
import { CreateDoNotApplySchema, QuickAddDoNotApplySchema } from '@warroom/shared';

export const doNotApplyRouter = new Hono();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  blockType: z.enum(['hard', 'soft']).optional(),
  includeExpired: z.coerce.boolean().default(false),
});

const COLS = {
  id: doNotApply.id,
  companyId: doNotApply.companyId,
  reasonCategory: doNotApply.reasonCategory,
  reasonNotes: doNotApply.reasonNotes,
  blockType: doNotApply.blockType,
  reconsiderAt: doNotApply.reconsiderAt,
  addedAt: doNotApply.addedAt,
  companyName: companies.name,
  companyDbId: companies.id,
};

type Row = {
  id: number;
  companyId: number;
  reasonCategory: string;
  reasonNotes: string | null;
  blockType: string;
  reconsiderAt: Date | null;
  addedAt: Date;
  companyName: string | null;
  companyDbId: number | null;
};

function mapRow(row: Row) {
  return {
    id: row.id,
    companyId: row.companyId,
    company:
      row.companyDbId !== null && row.companyName !== null
        ? { id: row.companyDbId, name: row.companyName }
        : undefined,
    reasonCategory: row.reasonCategory,
    reasonNotes: row.reasonNotes,
    blockType: row.blockType,
    reconsiderAt: row.reconsiderAt?.toISOString() ?? null,
    addedAt: row.addedAt.toISOString(),
  };
}

async function fetchWithCompany(id: number) {
  const rows = await db
    .select(COLS)
    .from(doNotApply)
    .leftJoin(companies, eq(doNotApply.companyId, companies.id))
    .where(eq(doNotApply.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new HTTPException(500, { message: 'Entry not found after insert' });
  return mapRow(row as Row);
}

doNotApplyRouter.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { limit, offset, blockType, includeExpired } = c.req.valid('query');
  const now = new Date();

  const where = and(
    blockType !== undefined ? eq(doNotApply.blockType, blockType) : undefined,
    !includeExpired
      ? or(
        eq(doNotApply.blockType, 'hard'),
        isNull(doNotApply.reconsiderAt),
        gt(doNotApply.reconsiderAt, now),
      )
      : undefined,
  );

  try {
    const rows = await db
      .select(COLS)
      .from(doNotApply)
      .leftJoin(companies, eq(doNotApply.companyId, companies.id))
      .where(where)
      .orderBy(desc(doNotApply.addedAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(doNotApply)
      .where(where);

    return c.json({
      items: rows.map((r) => mapRow(r as Row)),
      total: countRow?.count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    logger.error({ err }, 'doNotApply list error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

doNotApplyRouter.post('/', zValidator('json', CreateDoNotApplySchema), async (c) => {
  const body = c.req.valid('json');

  const existing = await db
    .select({ id: doNotApply.id })
    .from(doNotApply)
    .where(eq(doNotApply.companyId, body.companyId))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: 'Company is already on the Do Not Apply list' }, 409);
  }

  try {
    const [row] = await db
      .insert(doNotApply)
      .values({
        companyId: body.companyId,
        reasonCategory: body.reasonCategory,
        reasonNotes: body.reasonNotes ?? null,
        blockType: body.blockType,
        reconsiderAt: body.reconsiderAt ? new Date(body.reconsiderAt) : null,
      })
      .returning({ id: doNotApply.id });

    if (!row) throw new Error('Insert returned no rows');
    return c.json(await fetchWithCompany(row.id), 201);
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, 'doNotApply create error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

doNotApplyRouter.post('/quick-add', zValidator('json', QuickAddDoNotApplySchema), async (c) => {
  const body = c.req.valid('json');
  const domain = body.domain.replace(/^www\./i, '').toLowerCase();

  try {
    // 1. Look up by domain
    let company = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.domain, domain))
      .limit(1)
      .then((r) => r[0] ?? null);

    // 2. Look up by normalizedName
    if (!company) {
      company = await db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(eq(companies.normalizedName, domain))
        .limit(1)
        .then((r) => r[0] ?? null);
    }

    // 3. Create company if needed
    if (!company) {
      const [created] = await db
        .insert(companies)
        .values({ name: domain, normalizedName: domain, domain })
        .returning({ id: companies.id, name: companies.name });
      if (!created) throw new Error('Failed to create company');
      company = created;
    }

    const companyId = company.id;

    // 4. Check if already on list — idempotent, return 200
    const existingRows = await db
      .select(COLS)
      .from(doNotApply)
      .leftJoin(companies, eq(doNotApply.companyId, companies.id))
      .where(eq(doNotApply.companyId, companyId))
      .limit(1);

    if (existingRows.length > 0) {
      return c.json(mapRow(existingRows[0] as Row), 200);
    }

    // 5. Create entry
    const [created] = await db
      .insert(doNotApply)
      .values({
        companyId,
        reasonCategory: body.reasonCategory,
        reasonNotes: null,
        blockType: 'hard',
      })
      .returning({ id: doNotApply.id });

    if (!created) throw new Error('Insert returned no rows');
    return c.json(await fetchWithCompany(created.id), 201);
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, 'doNotApply quick-add error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

doNotApplyRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) throw new HTTPException(400, { message: 'Invalid id' });

  try {
    const deleted = await db
      .delete(doNotApply)
      .where(eq(doNotApply.id, id))
      .returning({ id: doNotApply.id });

    if (deleted.length === 0) return c.json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error({ err }, 'doNotApply delete error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});
