---
name: create-migration
description: Scaffold a new Supabase migration file in supabase/migrations/, following this repo's naming convention and its SECURITY DEFINER RPC pattern for atomic writes under RLS. Use when the user asks to add/change a table, column, RPC function, or RLS policy.
disable-model-invocation: true
---

# Create migration

This repo's migrations live in `supabase/migrations/` and are named `YYYYMMDDHHMMSS_description.sql` (see `2026080500000_atomic_save_rpcs.sql`). Schema is protected by RLS; anything that needs to bypass RLS for a legitimate write (e.g. an atomic replace-all from an admin form) goes through a `SECURITY DEFINER` RPC function, never a direct table grant to `anon`/`authenticated`.

## Steps

1. **Understand the change**: ask the user (if not already clear) what table/column/RPC/policy is changing and why. Check `supabase/migrations/` for prior migrations touching the same tables so the new one stays consistent with existing column names/types.

2. **Pick the timestamp**: run `date -u +%Y%m%d%H%M%S` for the filename prefix — migrations apply in filename order, so it must sort after every existing file in `supabase/migrations/`.

3. **Plain DDL** (new table/column/index, RLS policy tightening): write straightforward SQL. Every new table needs RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) and explicit policies — never leave a new table world-writable by default.

4. **RPC functions that bypass RLS** (atomic multi-row writes, admin-only mutations): follow the pattern in `20260805000000_atomic_save_rpcs.sql`:
    - `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public` — the `search_path` pin prevents search-path hijacking in a `SECURITY DEFINER` function.
    - First statement in the body: `IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;` — never rely on the caller having already checked this.
    - Validate any enum-like/category text parameter with an explicit `IF ... NOT IN (...) THEN RAISE EXCEPTION` — don't trust client-supplied category strings.
    - Prefer a single transaction (the function body) doing delete+insert over exposing separate delete/insert RPCs, so a partial failure can't leave the table half-updated.
    - After `CREATE OR REPLACE FUNCTION`, always add:
        ```sql
        REVOKE ALL ON FUNCTION public.fn_name(arg_types) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.fn_name(arg_types) TO authenticated;
        ```
        (or a narrower role if the RPC is admin-only) — a `SECURITY DEFINER` function with no `REVOKE`/`GRANT` is callable by any authenticated user by default.

5. **Write the file** to `supabase/migrations/<timestamp>_<description>.sql` with a short header comment (`-- Migration: <name>`, `-- Purpose: ...`) matching the existing style.

6. **Tell the user how to apply it**: this repo has no `supabase/config.toml` checked in, so migrations are applied to the remote project (via the Supabase MCP tools' `apply_migration`, or the Supabase dashboard/CLI directly) rather than a local `supabase db push` workflow — don't assume a local Postgres is running.

## Output

The new migration file path, plus a one-line summary of what it changes and which RPCs/tables/policies are affected. If the change exposes a new RPC, note the exact `REVOKE`/`GRANT` line so the caller can double check the intended role scope.
