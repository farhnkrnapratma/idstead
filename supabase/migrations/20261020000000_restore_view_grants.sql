-- Reverts 20261019160000_hide_view_ip_hash: PostgREST's embedded db_views(count)
-- needs table-level SELECT, so the column grant broke public view counts.
grant select, insert, update, references on public.db_views to anon, authenticated;
