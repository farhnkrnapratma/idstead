alter table public.db_posts drop constraint if exists posts_slug_pattern_check;
alter table public.db_posts add constraint posts_slug_pattern_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100 and slug not in ('banners', 'content'));
