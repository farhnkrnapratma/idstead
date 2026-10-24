---
name: create-migration
description: Scaffold a new Cloudflare D1 (SQLite) migration in packages/data/d1/migrations/, following this repo's numbering, column conventions, CHECK constraints and read-cache triggers, together with the port, adapter, contract-suite and docs updates a schema change needs. Use when the user asks to add or change a table, column, index, trigger or view.
disable-model-invocation: true
---

# Create migration

The data layer runs on Cloudflare D1. Every schema change is a new, never-edited SQL file in `packages/data/d1/migrations/`, numbered in order (`0001_init.sql`, `0002_admin_views.sql`, `0003_oidc.sql`, …). D1 has **no row-level security**: tables are reached only through the ports in `packages/data/src/` and their D1 adapters in `packages/data/src/d1/` (the only place SQL is written), and every caller of `dataStores().service` must check its caller first. `supabase/migrations/` is the history of the retired Postgres schema; never add to it.

## Steps

1. **Understand the change**: ask the user, if it is not already clear, which table, column, index, trigger or view changes and why. Read the migrations that already touch the same tables, and `docs/003-architecture/009-database-schema.md`, so names and types stay consistent.

2. **Pick the number**: list `packages/data/d1/migrations/` and use the next four-digit number with a short snake_case description (`0004_post_series.sql`). Never edit or renumber a migration that exists; D1 records applied files by name.

3. **Follow the column conventions** of `0001_init.sql`:
    - **IDs:** UUIDs are `TEXT` with the random-v4 default used in `0001_init.sql`. Anything exposed publicly gets its own random `public_id` (64 hex, or 32 hex for internal handles), because database IDs never leave admin-only ports.
    - **Timestamps:** `TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`, ISO 8601 UTC with milliseconds.
    - **Booleans and JSON:** booleans are `INTEGER` with `CHECK (col IN (0, 1))`; JSON is `TEXT` with `CHECK (json_valid(col) AND json_type(col) = 'array')` (or `'object'`).
    - **Constraints:** D1 has no regular expressions, so pattern checks use `GLOB` (`col NOT GLOB '*[^0-9a-f]*'`). Add `CHECK` constraints for lengths and allowed values, and `BEFORE` triggers with `RAISE(ABORT, '...')` where a check needs a subquery.
    - **Credentials:** secrets, tokens and codes are stored only as SHA-256 hex (`CHECK (length(col) = 64 AND col NOT GLOB '*[^0-9a-f]*')`), never in plain text.
    - **Foreign keys:** use `ON DELETE CASCADE` only where removing the parent must remove the rows; D1 enforces foreign keys.

4. **Read cache**: if the table feeds a cached public read (`author`, `blog`, `legal`, `comments:<post id>` in `db_cache_generations`), add `AFTER INSERT/UPDATE/DELETE` triggers that bump the domain's `gen`, like `db_profiles_cache_insert`. Without them, cached pages serve stale data until the Worker version changes. Tables that are never cached (admin-only, credentials, logs) need no trigger.

5. **Write the file**: plain SQL, no comments (the repo has a no-comments rule), statements separated by blank lines like the existing migrations.

6. **Update the code that uses it**:
    - **Ports and adapters:** the port in `packages/data/src/<group>.ts` (exported from `packages/data/src/index.ts`) and the adapter in `packages/data/src/d1/<group>.ts`. Bound parameters only (`?1`, `.bind(...)`), and throw `DataError('<operation>', error)`. Wire new stores in `packages/lib/src/server/data.ts` (`dataStores`), the only place that may import `createD1*`.
    - **Data export and delete-all:** decide deliberately in `packages/data/src/d1/siteData.ts`. Credential tables stay out of the export.
    - **Contract suite:** add or extend `tests/contracts/<group>.contract.ts` and run it against the adapter through the `bun:sqlite` D1 shim (`tests/support/d1.ts`, which applies every migration).
    - **Schema checks:** `tests/d1Schema.test.ts` covers the retired Postgres columns and the triggers; extend it when you add triggers or constraints that guard data.

7. **Document it**: update `docs/003-architecture/009-database-schema.md` (D1-only tables go under "D1-only tables") and, for a new port group, the data layer paragraph in `CLAUDE.md` / `AGENTS.md`.

8. **Apply it**:
    - **Locally:** `bun run db:local` applies every pending migration to the shared local D1 that the dev servers use; run it, then `phase run --env dev -- bun run test`.
    - **Production:** `bunx wrangler d1 migrations apply <database> --remote` from `apps/web`, where the database is `cloudflare.database.name` in `idstead.jsonc`. It changes the live database, so ask the user before running it, and apply it before deploying code that needs it.

## Output

The new migration path, a one-line summary of what it changes, and the list of code, test and doc files that were updated with it. Call out any table that holds credentials or is exposed publicly, and say whether it is cached (and which generation triggers bump it).
