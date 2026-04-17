import { BaseIngester, type RawSignal } from './base.js';
import { logger } from '../logger.js';

const ALGOLIA_BY_DATE = 'https://hn.algolia.com/api/v1/search_by_date';
const HN_USER_API = 'https://hacker-news.firebaseio.com/v0/user/whoishiring.json';
const HN_ITEM_API = 'https://hacker-news.firebaseio.com/v0/item';

// Matches ONLY the canonical monthly hiring thread: "Ask HN: Who is hiring? (Month Year)"
const HIRING_THREAD_RE = /^Ask HN: Who is hiring\? \(\w+ \d{4}\)$/i;

interface HNUser {
  submitted: number[];
}

interface HNItem {
  id: number;
  title?: string;
  type?: string;
}

interface AlgoliaHit {
  objectID: string;
  title?: string;
  comment_text?: string;
  author?: string;
  created_at?: string;
  story_id?: number;
  /** parent_id === storyId for top-level comments; nested replies have a comment id */
  parent_id?: number;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbHits: number;
}

/**
 * Hacker News "Who is Hiring?" ingester.
 *
 * Strategy:
 *   1. Find the most recent canonical monthly thread via the whoishiring HN user.
 *      The submitted array is newest-first; we fetch each item and stop at the
 *      first title matching HIRING_THREAD_RE.
 *   2. Pull all comments tagged with that story via Algolia.
 *   3. Filter to DIRECT kids only (parent_id === storyId) — replies are noise.
 *   4. Extract company name hint; reject candidates that look conversational
 *      or like job titles rather than company names.
 */
export class HNIngester extends BaseIngester {
  readonly sourceName = 'hn';

  protected async fetch(): Promise<RawSignal[]> {
    // ── Step 1: find the latest Who Is Hiring story via HN Firebase API ──
    const storyIdNum = await findCurrentHiringThread();
    if (storyIdNum === null) {
      logger.warn('hn ingester: no current Who Is Hiring thread found');
      return [];
    }

    const storyId = String(storyIdNum);

    // ── Step 2: fetch all comments for the story ─────────────────────────
    const commentsUrl = new URL(ALGOLIA_BY_DATE);
    commentsUrl.searchParams.set('tags', `comment,story_${storyId}`);
    // Algolia max per page is 1000; Who Is Hiring threads ~200 top-level + replies
    commentsUrl.searchParams.set('hitsPerPage', '1000');

    const commentsRes = await globalThis.fetch(commentsUrl.toString(), {
      signal: AbortSignal.timeout(20_000),
    });
    if (!commentsRes.ok) {
      throw new Error(`Algolia comments fetch failed: ${commentsRes.status}`);
    }

    const commentsData = (await commentsRes.json()) as AlgoliaResponse;

    logger.info(
      { total: commentsData.nbHits, fetched: commentsData.hits.length },
      'hn ingester: fetched comments',
    );

    // ── Step 3: filter to direct top-level kids only ─────────────────────
    // Bug fix: Algolia returns the full comment tree. A top-level comment's
    // parent_id equals the story's numeric id. Replies have a comment id.
    const topLevel = commentsData.hits.filter(
      (hit) =>
        hit.parent_id === storyIdNum &&
        hit.comment_text &&
        hit.comment_text.length > 20,
    );

    logger.info({ topLevel: topLevel.length }, 'hn ingester: top-level comments');

    // ── Step 4: map to RawSignal ──────────────────────────────────────────
    return topLevel.map((hit): RawSignal => {
      const text = stripHtml(hit.comment_text ?? '');
      const firstLine = (text.split('\n')[0] ?? '').trim();
      const companyHint = extractCompanyHint(firstLine);

      return {
        source: 'hn',
        sourceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        title: firstLine.slice(0, 200) || '(HN job post)',
        snippet: text.slice(0, 500),
        companyNameHint: companyHint,
        domainHint: null,
        publishedAt: hit.created_at ? new Date(hit.created_at) : null,
      };
    });
  }
}

// ── Thread discovery ─────────────────────────────────────────────────────────

/**
 * Walk the whoishiring user's submitted stories (newest-first) and return the
 * numeric ID of the first one whose title matches HIRING_THREAD_RE.
 */
async function findCurrentHiringThread(): Promise<number | null> {
  const userRes = await globalThis.fetch(HN_USER_API, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!userRes.ok) {
    throw new Error(`HN user fetch failed: ${userRes.status}`);
  }

  const user = (await userRes.json()) as HNUser;
  const submitted = user.submitted ?? [];

  for (const itemId of submitted) {
    const itemRes = await globalThis.fetch(`${HN_ITEM_API}/${itemId}.json`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!itemRes.ok) continue;

    const item = (await itemRes.json()) as HNItem;
    if (item.type !== 'story') continue;
    if (item.title && HIRING_THREAD_RE.test(item.title)) {
      logger.info({ storyId: itemId, title: item.title }, 'hn ingester: found thread');
      return itemId;
    }
  }

  return null;
}

// ── HTML / entity decoding ────────────────────────────────────────────────────

/**
 * Decode HTML numeric entities — both decimal (&#NNN;) and hex (&#xNN;).
 * Named entities (&amp; etc.) are handled separately below.
 */
function decodeNumericEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_match, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    );
}

/** Strip HTML tags and decode entities from Algolia comment_text. */
function stripHtml(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');

  const namedDecoded = withBreaks
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

  return decodeNumericEntities(namedDecoded).trim();
}

// ── Company name extraction ───────────────────────────────────────────────────

/**
 * Strings that start with these patterns are conversational openers,
 * not company names.
 */
const CONVERSATIONAL_OPENER_RE = new RegExp(
  [
    'hi[\\s,!]',
    'hey[\\s,!]',
    'thanks',
    'thank\\s',
    "i('m|\\s+am)\\s",
    'is\\s',
    'are\\s',
    'do\\s',
    'does\\s',
    'can\\s',
    'could\\s',
    'would\\s',
    "won't",
    'will\\s',
    'my\\s',
    'we\\s',
    "we'",
    'wow',
    'interesting',
    'those\\s+are',
    'this\\s+is',
    'unfortunately',
    'yes[,\\s!]',
    'no[,\\s!]',
    'actually',
    'just\\s',
    'as\\s',
    'at\\s',
    'for\\s',
    'if\\s',
    "it'?s\\s",
    'the\\s',
    '^a\\s',
    '^an\\s',
    'and\\s',
    'not\\s',
    'note:',
    'looking',
    'hiring',
    'seeking',
    'remote',
    'onsite',
    'salary',
    'equity',
    'apply',
    'about',
    'our\\s',
    'we are',
    "we're",
    'join\\s',
    'come\\s',
  ].join('|'),
  'i',
);

/**
 * Strings that start with job title words are role descriptions,
 * not company names.
 */
const JOB_TITLE_OPENER_RE =
  /^(senior|sr\.?\s|jr\.?\s|junior|staff|principal|lead|front[\s-]?end|frontend|full[\s-]?stack|fullstack|back[\s-]?end|backend|web\s+dev|software\s+eng|software\s+dev|engineer|developer|designer|architect|manager|director|head\s+of|vp\s+of|cto|ceo|cfo)\s/i;

/**
 * Returns true if the candidate looks like a real company name.
 * Rejects garbage extracted from conversational, role-first, or malformed lines.
 */
function looksLikeCompanyName(candidate: string): boolean {
  if (candidate.length < 2 || candidate.length > 80) return false;
  if (candidate.includes('?')) return false;
  if (CONVERSATIONAL_OPENER_RE.test(candidate)) return false;
  if (JOB_TITLE_OPENER_RE.test(candidate)) return false;
  return true;
}

/**
 * HN "Who is Hiring?" posts follow "Company | Role | Location | ..." format.
 * Extract the first pipe-delimited segment; reject if it fails the company name filter.
 */
function extractCompanyHint(firstLine: string): string | null {
  const parts = firstLine.split('|');
  const candidate = parts[0]?.trim() ?? '';
  if (!looksLikeCompanyName(candidate)) return null;
  return candidate;
}
