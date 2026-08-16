create or replace function public.validate_post_tags(p_tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_tags is null
    or (
      cardinality(p_tags) <= 5
      and not exists (
        select 1 from unnest(p_tags) as t(tag) where length(tag) > 30
      )
    )
$$;

alter table public.db_posts add column tags text[];

alter table public.db_posts
  add constraint db_posts_tags_valid check (public.validate_post_tags(tags));
