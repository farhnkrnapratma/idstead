-- Add AI-generated summary and TL;DR fields to db_posts

alter table if exists public.db_posts
  add column if not exists summary text,
  add column if not exists tldr text[];

create or replace function public.validate_post_tldr(p_tldr text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_tldr is null
    or (
      cardinality(p_tldr) <= 4
      and not exists (
        select 1 from unnest(p_tldr) as t(point) where length(point) > 200
      )
    )
$$;

alter table public.db_posts
  add constraint db_posts_tldr_valid check (public.validate_post_tldr(tldr));
