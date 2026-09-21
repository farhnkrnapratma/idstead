-- The aal2 requirement added to public.is_admin() only protects tables whose
-- policies call it. These three predate the db_ rename and still inline a bare
-- app_metadata.role check, so an aal1 token would keep full write access to
-- them the moment a second factor is enrolled.

drop policy if exists "author_profile admin insert" on public.db_profiles;
drop policy if exists "author_profile admin update" on public.db_profiles;
drop policy if exists "author_profile admin delete" on public.db_profiles;

create policy "author_profile admin insert" on public.db_profiles
  for insert to authenticated
  with check (public.is_admin());

create policy "author_profile admin update" on public.db_profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "author_profile admin delete" on public.db_profiles
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "Admins can view comment reports" on public.db_comment_reports;
drop policy if exists "Admins can delete comment reports" on public.db_comment_reports;

create policy "Admins can view comment reports" on public.db_comment_reports
  for select to authenticated
  using (public.is_admin());

create policy "Admins can delete comment reports" on public.db_comment_reports
  for delete to authenticated
  using (public.is_admin());

-- db_views accepted inserts straight from the anon role with WITH CHECK (true),
-- so the server-side hashing, dedupe and rate limiting on
-- /api/internal/blog/views bound nothing. That route now uses the service-role
-- client, which bypasses RLS, so the public policy is no longer needed.
drop policy if exists "Allow public inserts to post_views" on public.db_views;
