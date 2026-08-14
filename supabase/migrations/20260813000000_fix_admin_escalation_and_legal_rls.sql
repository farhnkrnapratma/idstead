-- Security fix: grant_admin_role_by_email(text) was created in
-- 20260811000000_secure_app_metadata_and_rpcs.sql without an is_admin()
-- guard and without a REVOKE from anon/PUBLIC (unlike db_save_legal right
-- above it in the same file). Verified live: anon could EXECUTE it,
-- letting an unauthenticated caller grant admin role_ to any email via
-- raw_app_meta_data. An admin account already exists, so the bootstrap
-- function has no remaining legitimate use -- drop it entirely rather than
-- gating it, per the same reasoning used for other one-off bootstrap paths.
DROP FUNCTION IF EXISTS public.grant_admin_role_by_email(text);

-- Security fix: db_legals (Privacy/Security/Terms content) was created in
-- 20260809000000_legal_pages.sql with an ALL-command policy scoped to
-- USING(true)/WITH CHECK(true) for role `authenticated` -- any logged-in
-- user, not just admins, could write these pages directly via PostgREST,
-- bypassing the admin-only db_save_legal RPC entirely. Replace with the
-- is_admin() gate used by every other admin-only table/RPC in this project
-- (see 20260807000000_close_rls_and_rpc_privilege_gaps.sql). The public
-- read policy is untouched.
DROP POLICY IF EXISTS "Authenticated users manage legal pages" ON public.db_legals;

CREATE POLICY "Admins manage legal pages"
  ON public.db_legals
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
