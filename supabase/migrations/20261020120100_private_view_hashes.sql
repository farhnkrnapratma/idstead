drop policy if exists "Allow public read access to post_views" on public.db_views;
revoke all on public.db_views from anon;
