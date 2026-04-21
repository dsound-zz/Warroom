# War Room — CLAUDE.md

This file is read by Claude/Antigravity at the start of every task session.

## Project summary
Local-only job-search operations dashboard. Single user, no auth.
Full TypeScript monorepo (pnpm workspaces). See README for architecture.

## Key conventions (enforced in all tasks)

- ESM only (`"type":"module"`, `.js` extensions in relative imports)
- Named exports everywhere — no default exports
- No `any` — use `unknown` and narrow
- Strict mode + `noUncheckedIndexedAccess` in all tsconfigs
- All Zod schemas live in `packages/shared`; never duplicate them
- No `console.log` — use the pino logger
- All timestamps stored as UTC (`timestamptz`)
- No raw SQL unless explained via comment; use Drizzle
- Ingesters always write to `ingester_runs`; catch → log → rethrow
- Phase 3 (LLM, embeddings, pgvector) is planned but NOT yet built
  - pgvector extension IS enabled in the first migration
  - Do not add any Phase 3 code until explicitly asked

## Stage vocabulary
applied | recruiter_screen | hm_screen | technical_screen |
take_home | onsite | offer | rejected | withdrawn | ghosted

## Database schema (current)

Tables: `companies`, `signals`, `applications`, `stage_events`,
`ingester_runs`, `dna`, `do_not_apply`, `contacts`, `interview_notes`

**Two separate concepts — do NOT confuse them:**
- `dna` table = professional DNA / experience units (roles, skills,
  achievements, education) — for Phase 3 content engine
- `do_not_apply` table = companies to avoid applying to

The `signals` table has a `raw_payload jsonb` column (added in Task 03
corrections migration). The HN ingester populates it.

Migrations live in `packages/backend/drizzle/`. Three migrations applied:
`0000_initial`, `0001_signals_act_dismiss`, `0002_round_madame_hydra`.

## API routes (current)

All routes are mounted under `/api`.

| Route | File |
|---|---|
| `/api/health` | routes/health.ts |
| `/api/signals` | routes/signals.ts |
| `/api/companies` | routes/companies.ts |
| `/api/applications` | routes/applications.ts |
| `/api/dna` | routes/dna.ts |
| `/api/do-not-apply` | routes/doNotApply.ts |
| `GET /api/bookmarklet` | inline in index.ts |

`GET /api/signals` enriches each signal with `isDna: boolean` — true if
the signal's company is on the do_not_apply list.

`POST /api/do-not-apply/quick-add` is idempotent (returns 200 if the
domain is already blocked, 201 on new entry). Used by the bookmarklet.

## Frontend pages (current)

- `/today` — signals feed with act/dismiss actions; shows DNA badge on
  signals from blocked companies
- `/companies` — searchable company list with DNA badges, inline
  add-to-DNA form, remove-from-DNA action, load-more pagination
- `/pipeline` — stub (Task 05)

Frontend uses TanStack Query v5. Query keys: `['signals', ...]`,
`['companies', search]`, `['doNotApply']`.

## Shared Zod schemas (packages/shared/src/)

`stages`, `signals`, `companies`, `applications`, `doNotApply`,
`constants`. All exported via `index.ts`.

`DoNotApply` reason categories: `bad_interview | ghosted | wrong_stack |
wrong_stage | ethical_concerns | already_rejected | hiring_freeze | other`

Block types: `hard` (permanent) | `soft` (reconsider later, see
`reconsiderAt`). `GET /api/do-not-apply` excludes expired soft blocks
by default (`includeExpired=false`).

## Task response format
1. Brief restatement of the goal
2. Plan in 3–8 steps
3. Implementation, one file at a time with path stated
4. Acceptance-criteria verification commands

## Stop conditions
- Migration would destroy data → stop and ask
- Task seems underspecified about schema/API shape → stop and ask
- Conflict found in existing repo → stop and ask
