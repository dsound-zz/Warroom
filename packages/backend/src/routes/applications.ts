import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { applications, companies, stageEvents } from '../db/schema.js';
import { logger } from '../logger.js';
import {
  CreateApplicationSchema,
  UpdateApplicationSchema,
  StageSchema,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '@warroom/shared';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
  stage: StageSchema.optional(),
  companyId: z.coerce.number().int().positive().optional(),
});

export const applicationsRouter = new Hono();

applicationsRouter.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { limit, offset, stage, companyId } = c.req.valid('query');

  try {
    const rows = await db
      .select({
        id: applications.id,
        companyId: applications.companyId,
        companyName: companies.name,
        role: applications.role,
        stage: applications.stage,
        url: applications.url,
        notes: applications.notes,
        appliedAt: applications.appliedAt,
        lastActivityAt: applications.lastActivityAt,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
      })
      .from(applications)
      .leftJoin(companies, eq(applications.companyId, companies.id))
      .where(
        sql`${stage !== undefined ? sql`${applications.stage} = ${stage} AND ` : sql``}
            ${companyId !== undefined ? sql`${applications.companyId} = ${companyId} AND ` : sql``}
            TRUE`,
      )
      .orderBy(desc(applications.lastActivityAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(applications)
      .where(
        sql`${stage !== undefined ? sql`${applications.stage} = ${stage} AND ` : sql``}
            ${companyId !== undefined ? sql`${applications.companyId} = ${companyId} AND ` : sql``}
            TRUE`,
      );

    return c.json({ items: rows, total: countRow?.count ?? 0, limit, offset });
  } catch (err) {
    logger.error({ err }, 'applications list error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

applicationsRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) throw new HTTPException(400, { message: 'Invalid id' });

  try {
    const [row] = await db
      .select({
        id: applications.id,
        companyId: applications.companyId,
        companyName: companies.name,
        role: applications.role,
        stage: applications.stage,
        url: applications.url,
        notes: applications.notes,
        appliedAt: applications.appliedAt,
        lastActivityAt: applications.lastActivityAt,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
      })
      .from(applications)
      .leftJoin(companies, eq(applications.companyId, companies.id))
      .where(eq(applications.id, id))
      .limit(1);

    if (!row) throw new HTTPException(404, { message: 'Application not found' });
    return c.json(row);
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, 'applications get error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

applicationsRouter.post('/', zValidator('json', CreateApplicationSchema), async (c) => {
  const body = c.req.valid('json');

  try {
    const [row] = await db.insert(applications).values(body).returning();
    if (!row) throw new HTTPException(500, { message: 'Insert failed' });

    // Record initial stage event
    await db.insert(stageEvents).values({
      applicationId: row.id,
      fromStage: null,
      toStage: row.stage,
    });

    return c.json(row, 201);
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, 'applications create error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

applicationsRouter.patch('/:id', zValidator('json', UpdateApplicationSchema), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) throw new HTTPException(400, { message: 'Invalid id' });

  const body = c.req.valid('json');

  try {
    const [existing] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1);
    if (!existing) throw new HTTPException(404, { message: 'Application not found' });

    const [updated] = await db
      .update(applications)
      .set({ ...body, lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();

    // Record stage transition if stage changed
    if (body.stage && body.stage !== existing.stage) {
      await db.insert(stageEvents).values({
        applicationId: id,
        fromStage: existing.stage,
        toStage: body.stage,
      });
    }

    return c.json(updated);
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, 'applications patch error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

applicationsRouter.get('/:id/events', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) throw new HTTPException(400, { message: 'Invalid id' });

  try {
    const rows = await db
      .select()
      .from(stageEvents)
      .where(eq(stageEvents.applicationId, id))
      .orderBy(desc(stageEvents.occurredAt));
    return c.json(rows);
  } catch (err) {
    logger.error({ err }, 'stage events list error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});
