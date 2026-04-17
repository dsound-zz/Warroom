import Parser from 'rss-parser';
import { BaseIngester, type RawSignal } from './base.js';

const TC_RSS = 'https://techcrunch.com/tag/hiring/feed/';

export class TechCrunchIngester extends BaseIngester {
  readonly sourceName = 'techcrunch';

  protected async fetch(): Promise<RawSignal[]> {
    const parser = new Parser();
    const feed = await parser.parseURL(TC_RSS);

    return (feed.items ?? []).map((item) => ({
      source: 'techcrunch',
      sourceUrl: item.link ?? item.guid ?? '',
      title: item.title ?? '(no title)',
      snippet: item.contentSnippet?.slice(0, 500) ?? null,
      companyNameHint: null, // TC posts rarely have a clear single company
      domainHint: null,
      publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    }));
  }
}
