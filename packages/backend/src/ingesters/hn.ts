import Parser from 'rss-parser';
import { BaseIngester, type RawSignal } from './base.js';

const HN_WHO_IS_HIRING_RSS =
  'https://hnrss.org/whoishiring?q=hiring&count=50';

export class HNIngester extends BaseIngester {
  readonly sourceName = 'hn';

  protected async fetch(): Promise<RawSignal[]> {
    const parser = new Parser();
    const feed = await parser.parseURL(HN_WHO_IS_HIRING_RSS);

    return (feed.items ?? []).map((item) => ({
      source: 'hn',
      sourceUrl: item.link ?? item.guid ?? '',
      title: item.title ?? '(no title)',
      snippet: item.contentSnippet?.slice(0, 500) ?? null,
      companyNameHint: extractCompanyFromHNTitle(item.title ?? ''),
      domainHint: null,
      publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    }));
  }
}

/**
 * HN "Who is Hiring?" posts typically follow "Company | Role | Location" format.
 * We extract the first segment as the company name hint.
 */
function extractCompanyFromHNTitle(title: string): string | null {
  const parts = title.split('|');
  const first = parts[0]?.trim();
  return first && first.length > 0 ? first : null;
}
