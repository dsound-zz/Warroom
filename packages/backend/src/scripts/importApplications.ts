/**
 * Import applications from a JSON file.
 * Usage: pnpm import:applications -- path/to/applications.json
 *
 * JSON shape: array of CreateApplication objects.
 */
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { db } from '../db/index.js';
import { applications, stageEvents } from '../db/schema.js';
import { CreateApplicationSchema } from '@warroom/shared';
import { logger } from '../logger.js';

const FileSchema = z.array(CreateApplicationSchema);

const filePath = process.argv[2];
if (!filePath) {
  logger.error('Usage: pnpm import:applications -- <path-to-json>');
  process.exit(1);
}

async function main() {
  const raw = await readFile(filePath!, 'utf8');
  const parsed = FileSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    logger.error({ errors: parsed.error.flatten() }, 'Invalid applications file');
    process.exit(1);
  }

  const items = parsed.data;
  logger.info({ count: items.length }, 'importing applications');

  for (const item of items) {
    // Drizzle timestamp columns require Date, not ISO string
    const [row] = await db
      .insert(applications)
      .values({ ...item, appliedAt: item.appliedAt ? new Date(item.appliedAt) : null })
      .returning();
    if (!row) continue;

    await db.insert(stageEvents).values({
      applicationId: row.id,
      fromStage: null,
      toStage: row.stage,
    });
  }

  logger.info({ count: items.length }, 'applications import complete');
}

main().catch((err: unknown) => {
  logger.error({ err }, 'importApplications failed');
  process.exit(1);
});
