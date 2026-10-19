-- Visitors may count views but not read the daily visitor hash.
revoke select, insert, update, references on public.db_views from anon, authenticated;
grant select (id, post_id, viewed_at) on public.db_views to anon, authenticated;
