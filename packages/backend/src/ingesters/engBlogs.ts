import { load as cheerioLoad } from 'cheerio';
import { BaseIngester, type RawSignal } from './base.js';
import { logger } from '../logger.js';

interface WatchlistEntry {
  name: string;
  url: string;
  selector?: string;
}

/**
 * Engineering blog ingester — reads watchlist.json and scrapes job-related posts.
 * Add entries to watchlist.json to expand coverage.
 */
export class EngBlogsIngester extends BaseIngester {
  readonly sourceName = 'engBlogs';

  protected async fetch(): Promise<RawSignal[]> {
    const watchlistPath = new URL('../../../watchlist.json', import.meta.url).pathname;
    const { default: watchlist } = (await import(watchlistPath, {
      assert: { type: 'json' },
    })) as { default: WatchlistEntry[] };

    const results: RawSignal[] = [];

    for (const entry of watchlist) {
      try {
        const res = await fetch(entry.url, {
          headers: { 'User-Agent': 'WarRoom/1.0 (+local)' },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          logger.warn({ url: entry.url, status: res.status }, 'engBlogs fetch non-200');
          continue;
        }

        const html = await res.text();
        const $ = cheerioLoad(html);
        const selector = entry.selector ?? 'a';

        $(selector).each((_i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim();
          if (!href || !text) return;

          const absUrl = href.startsWith('http') ? href : new URL(href, entry.url).toString();

          // Only include links that look job-related
          if (!isJobRelated(text)) return;

          results.push({
            source: 'engBlogs',
            sourceUrl: absUrl,
            title: text.slice(0, 200),
            snippet: null,
            companyNameHint: entry.name,
            domainHint: new URL(entry.url).hostname,
            publishedAt: null,
          });
        });
      } catch (err) {
        logger.error({ err, url: entry.url }, 'engBlogs scrape error');
        // Continue with other entries rather than failing the whole run
      }
    }

    return results;
  }
}

const JOB_KEYWORDS = /\b(hir|job|role|position|engineer|developer|open|career|talent)\b/i;

function isJobRelated(text: string): boolean {
  return JOB_KEYWORDS.test(text);
}
