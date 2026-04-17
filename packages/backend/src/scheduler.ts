import cron from 'node-cron';
import { HNIngester } from './ingesters/hn.js';
import { TechCrunchIngester } from './ingesters/techcrunch.js';
import { EngBlogsIngester } from './ingesters/engBlogs.js';
import { logger } from './logger.js';

const ingesters = [new HNIngester(), new TechCrunchIngester(), new EngBlogsIngester()];

async function runAll() {
  for (const ingester of ingesters) {
    try {
      const result = await ingester.run();
      logger.info({ ingester: ingester.sourceName, ...result }, 'scheduled run complete');
    } catch (err) {
      logger.error({ err, ingester: ingester.sourceName }, 'scheduled run failed');
      // Do not re-throw — let others continue
    }
  }
}

/**
 * Register cron jobs. Called once at server startup.
 * Runs all ingesters every 6 hours.
 */
export function startScheduler(): void {
  logger.info('scheduler registered: all ingesters every 6 hours');

  cron.schedule('0 */6 * * *', () => {
    logger.info('cron: starting ingester sweep');
    void runAll();
  });
}
