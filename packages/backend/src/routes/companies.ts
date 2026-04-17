import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { eq, ilike, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { companies } from '../db/schema.js';
import { logger } from '../logger.js';
import { CreateCompanySchema, DEFAULT_LIMIT, MAX_LIMIT } from '@warroom/shared';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
});

export const companiesRouter = new Hono();

companiesRouter.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { limit, offset, search } = c.req.valid('query');

  try {
    const rows = await db
      .select()
      .from(companies)
      .where(search ? ilike(companies.name, `%${search}%`) : undefined)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(companies)
      .where(search ? ilike(companies.name, `%${search}%`) : undefined);

    return c.json({ items: rows, total: countRow?.count ?? 0, limit, offset });
  } catch (err) {
    logger.error({ err }, 'companies list error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

companiesRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) throw new HTTPException(400, { message: 'Invalid id' });

  try {
    const [row] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    if (!row) throw new HTTPException(404, { message: 'Company not found' });
    return c.json(row);
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, 'companies get error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

companiesRouter.post('/', zValidator('json', CreateCompanySchema), async (c) => {
  const body = c.req.valid('json');
  const normalizedName = body.name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|gmbh)\b\.?/gi, '')
    .replace(/https?:\/\/|www\./gi, '')
    .trim()
    .replace(/[.,;:'"!?]+$/g, '');

  try {
    const [row] = await db
      .insert(companies)
      .values({ ...body, normalizedName })
      .returning();
    return c.json(row, 201);
  } catch (err) {
    logger.error({ err }, 'companies create error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

companiesRouter.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id < 1) throw new HTTPException(400, { message: 'Invalid id' });

  const PatchSchema = z.object({
    name: z.string().min(1).optional(),
    domain: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  });

  const body = PatchSchema.safeParse(await c.req.json());
  if (!body.success) throw new HTTPException(400, { message: 'Validation failed' });

  try {
    const [row] = await db
      .update(companies)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    if (!row) throw new HTTPException(404, { message: 'Company not found' });
    return c.json(row);
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    logger.error({ err }, 'companies patch error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});
