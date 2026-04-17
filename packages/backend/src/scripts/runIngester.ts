/**
 * CLI script to manually trigger a single ingester.
 * Usage: pnpm ingester:hn | pnpm ingester:techcrunch | pnpm ingester:engblogs
 */
import { HNIngester } from '../ingesters/hn.js';
import { TechCrunchIngester } from '../ingesters/techcrunch.js';
import { EngBlogsIngester } from '../ingesters/engBlogs.js';
import { logger } from '../logger.js';

const name = process.argv[2];

const map: Record<string, () => Promise<void>> = {
  hn: async () => {
    const result = await new HNIngester().run();
    logger.info(result, 'hn ingester done');
  },
  techcrunch: async () => {
    const result = await new TechCrunchIngester().run();
    logger.info(result, 'techcrunch ingester done');
  },
  engBlogs: async () => {
    const result = await new EngBlogsIngester().run();
    logger.info(result, 'engBlogs ingester done');
  },
};

const fn = map[name ?? ''];
if (!fn) {
  logger.error({ available: Object.keys(map) }, `Unknown ingester: "${name ?? ''}"`);
  process.exit(1);
}

fn().catch((err: unknown) => {
  logger.error({ err }, 'ingester script failed');
  process.exit(1);
});
