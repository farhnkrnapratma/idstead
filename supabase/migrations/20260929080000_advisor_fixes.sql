-- Missing indexes on foreign key columns (Supabase advisor: unindexed_foreign_keys)
create index if not exists db_admin_notifications_comment_id_idx on public.db_admin_notifications (comment_id);
create index if not exists db_admin_notifications_post_id_idx on public.db_admin_notifications (post_id);
create index if not exists db_feedback_events_post_id_idx on public.db_feedback_events (post_id);
create index if not exists db_feedback_operations_event_id_idx on public.db_feedback_operations (event_id);
create index if not exists db_post_feedback_post_id_idx on public.db_post_feedback (post_id);

-- Mutable search_path (Supabase advisor: function_search_path_mutable)
-- Both functions already fully qualify every reference (public.db_posts, pg_catalog.*),
-- which is always implicitly searched regardless of search_path, so this is safe.
alter function public.enforce_max_pinned_posts() set search_path = '';
alter function public.parse_month_year_to_date(text, integer) set search_path = '';

-- Duplicate permissive SELECT policies left over from the db_-prefix rename
-- (Supabase advisor: multiple_permissive_policies). Each pair/trio below is a
-- byte-for-byte duplicate (same role, same `true` qual) of the canonical
-- "Public X select" policy already kept on the table, so dropping the older
-- one changes nothing about who can read what.
drop policy "Allow public read access to skill_categories" on public.db_categories;
drop policy "Allow public read access to cv_documents" on public.db_documents;
drop policy "Allow public read access to education" on public.db_educations;
drop policy "Allow public read access to experiences" on public.db_experiences;
drop policy "Allow public read access to skill_items" on public.db_items;
drop policy "Allow public read access to author_links" on public.db_links;
drop policy "Allow public read access to author_profile" on public.db_profiles;
drop policy "author_profile public read" on public.db_profiles;
