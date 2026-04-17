/**
 * Import professional DNA from a JSON file.
 * Usage: pnpm import:dna -- path/to/dna.json
 *
 * JSON shape: array of { kind, content, meta? }
 * kind must be one of: role | skill | achievement | education
 */
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { db } from '../db/index.js';
import { dna } from '../db/schema.js';
import { logger } from '../logger.js';

const DnaItemSchema = z.object({
  kind: z.enum(['role', 'skill', 'achievement', 'education']),
  content: z.string().min(1),
  meta: z.record(z.unknown()).optional(),
});

const DnaFileSchema = z.array(DnaItemSchema);

const filePath = process.argv[2];
if (!filePath) {
  logger.error('Usage: pnpm import:dna -- <path-to-json>');
  process.exit(1);
}

async function main() {
  const raw = await readFile(filePath!, 'utf8');
  const parsed = DnaFileSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    logger.error({ errors: parsed.error.flatten() }, 'Invalid DNA file');
    process.exit(1);
  }

  const items = parsed.data;
  logger.info({ count: items.length }, 'importing DNA entries');

  for (const item of items) {
    // meta is optional in schema but Drizzle's jsonb column rejects undefined
    await db.insert(dna).values({ kind: item.kind, content: item.content, meta: item.meta ?? null });
  }

  logger.info({ count: items.length }, 'DNA import complete');
}

main().catch((err: unknown) => {
  logger.error({ err }, 'importDna failed');
  process.exit(1);
});
