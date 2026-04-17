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

## Task response format
1. Brief restatement of the goal
2. Plan in 3–8 steps
3. Implementation, one file at a time with path stated
4. Acceptance-criteria verification commands

## Stop conditions
- Migration would destroy data → stop and ask
- Task seems underspecified about schema/API shape → stop and ask
- Conflict found in existing repo → stop and ask
