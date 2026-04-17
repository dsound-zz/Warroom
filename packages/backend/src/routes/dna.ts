import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dna } from '../db/schema.js';
import { logger } from '../logger.js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const DnaKindSchema = z.enum(['role', 'skill', 'achievement', 'education']);

const CreateDnaSchema = z.object({
  kind: DnaKindSchema,
  content: z.string().min(1),
  meta: z.record(z.unknown()).optional(),
});

export const dnaRouter = new Hono();

dnaRouter.get('/', async (c) => {
  try {
    const rows = await db.select().from(dna).orderBy(desc(dna.createdAt));
    return c.json(rows);
  } catch (err) {
    logger.error({ err }, 'dna list error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

dnaRouter.post('/', zValidator('json', CreateDnaSchema), async (c) => {
  const body = c.req.valid('json');
  try {
    const [row] = await db.insert(dna).values(body).returning();
    return c.json(row, 201);
  } catch (err) {
    logger.error({ err }, 'dna create error');
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});
