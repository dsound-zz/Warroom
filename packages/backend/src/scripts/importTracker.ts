/**
 * Import a jobs-tracker CSV into War Room.
 *
 * Expected columns (case-insensitive headers):
 *   company, role, contact_name, date, status, cooldown_flag,
 *   last_activity, job_url
 *
 * Usage:
 *   pnpm import:tracker -- path/to/tracker.csv
 *
 * What it does:
 *   - Finds or creates a company for each row
 *   - Creates an application (skips if same company + role already exists)
 *   - Adds a do_not_apply entry for "DO NOT CONTACT" rows
 *   - Creates a contact for rows with a non-empty contact_name
 *
 * Safe to re-run: duplicate companies/applications/DNA entries are skipped.
 */
import { readFileSync } from 'node:fs';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { companies, applications, stageEvents, doNotApply, contacts } from '../db/schema.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------
const STATUS_MAP: Record<string, string> = {
  APPLIED: 'applied',
  REJECTED: 'rejected',
  'REACHED OUT': 'applied',
  SAVED: 'applied',
  GHOSTED: 'ghosted',
  INTERVIEWING: 'hm_screen',
};

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields and escaped double-quotes
// ---------------------------------------------------------------------------
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rawHeaders = splitCSVLine(lines[0] ?? '');
  const headers = rawHeaders.map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
  );

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = splitCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = (values[i] ?? '').trim();
      });
      return row;
    });
}

// ---------------------------------------------------------------------------
// Company helpers
// ---------------------------------------------------------------------------
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/https?:\/\/|www\./gi, '')
    .replace(/\b(inc|llc|ltd|corp|co|gmbh)\b\.?/gi, '')
    .trim()
    .replace(/[.,;:'"!?/]+$/g, '')
    .trim();
}

async function findOrCreateCompany(name: string): Promise<number> {
  const normalized = normalizeCompanyName(name);
  if (!normalized) throw new Error(`Empty normalized name for: "${name}"`);

  const [existing] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.normalizedName, normalized))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(companies)
    .values({ name: name.trim(), normalizedName: normalized })
    .returning({ id: companies.id });

  if (!created) throw new Error(`Failed to create company: "${name}"`);
  return created.id;
}

// ---------------------------------------------------------------------------
// Date parsing — returns null for empty, invalid, or placeholder strings
// ---------------------------------------------------------------------------
function parseDate(raw: string): Date | null {
  if (!raw || raw === '-' || raw === 'N/A' || raw === 'n/a') return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const filePath = process.argv[2];
if (!filePath) {
  logger.error('Usage: pnpm import:tracker -- <path-to-csv>');
  process.exit(1);
}

async function main() {
  const content = readFileSync(filePath!, 'utf-8');
  const rows = parseCSV(content);

  logger.info({ rows: rows.length }, 'starting tracker import');

  const stats = { imported: 0, skipped: 0, dna: 0, contacts: 0 };

  for (const row of rows) {
    const companyName = row['company'] ?? '';
    if (!companyName) {
      stats.skipped++;
      continue;
    }

    // ── Company ─────────────────────────────────────────────────────────────
    let companyId: number;
    try {
      companyId = await findOrCreateCompany(companyName);
    } catch (err) {
      logger.warn({ err, company: companyName }, 'skipping row — company error');
      stats.skipped++;
      continue;
    }

    // ── Application ─────────────────────────────────────────────────────────
    const role = row['role'] || 'Unknown';
    const rawStatus = (row['status'] ?? '').toUpperCase().trim();
    const stage = STATUS_MAP[rawStatus] ?? 'applied';
    const appliedAt = parseDate(row['date'] ?? '');
    const lastActivityAt = parseDate(row['last_activity'] ?? '');
    const url = row['job_url'] || null;

    // Dedup: skip if this company + role already has an application
    const [existingApp] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.companyId, companyId), eq(applications.role, role)))
      .limit(1);

    if (existingApp) {
      logger.debug({ company: companyName, role }, 'application already exists, skipping');
      stats.skipped++;
    } else {
      const [app] = await db
        .insert(applications)
        .values({
          companyId,
          role,
          stage,
          url,
          appliedAt,
          lastActivityAt: lastActivityAt ?? new Date(),
        })
        .returning({ id: applications.id, stage: applications.stage });

      if (app) {
        await db.insert(stageEvents).values({
          applicationId: app.id,
          fromStage: null,
          toStage: app.stage,
        });
        stats.imported++;
      }
    }

    // ── Do Not Apply ─────────────────────────────────────────────────────────
    const cooldown = (row['cooldown_flag'] ?? '').toUpperCase().trim();
    if (cooldown.includes('DO NOT CONTACT')) {
      const reason = stage === 'rejected' ? 'already_rejected' : 'other';

      const [existingDna] = await db
        .select({ id: doNotApply.id })
        .from(doNotApply)
        .where(eq(doNotApply.companyId, companyId))
        .limit(1);

      if (!existingDna) {
        await db.insert(doNotApply).values({
          companyId,
          reasonCategory: reason,
          blockType: 'hard',
        });
        stats.dna++;
      }
    }

    // ── Contact ──────────────────────────────────────────────────────────────
    const contactName = row['contact_name'] ?? '';
    if (contactName) {
      const [existingContact] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.companyId, companyId), eq(contacts.name, contactName)))
        .limit(1);

      if (!existingContact) {
        await db.insert(contacts).values({
          companyId,
          name: contactName,
          relationship: 'cold',
        });
        stats.contacts++;
      }
    }
  }

  logger.info(stats, 'tracker import complete');
}

main().catch((err: unknown) => {
  logger.error({ err }, 'importTracker failed');
  process.exit(1);
});
