alter table public.db_activity_log add column if not exists ip text;

drop function public.db_activity_log_list(text, timestamptz, timestamptz, integer, integer, text, text, text);
drop function public.db_activity_log_export(text, timestamptz, timestamptz, text, text, text);

create function public.db_activity_log_list(
  p_category text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 10,
  p_offset integer default 0,
  p_query text default null,
  p_direction text default 'desc',
  p_sort text default 'created_at'
)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_direction is null or p_direction not in ('asc', 'desc') then
    raise exception 'Invalid sort direction';
  end if;
  if p_sort is null or p_sort not in ('created_at', 'category', 'action', 'actor', 'summary', 'ip') then
    raise exception 'Invalid sort field';
  end if;
  if p_category is not null and p_category not in ('profile', 'cv', 'skills', 'links', 'blog', 'auth', 'security') then
    raise exception 'Invalid category';
  end if;
  if p_from > p_to or length(p_query) > 250 or p_limit is null or p_limit not between 1 and 5000 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid log query';
  end if;
  return (
    with matched as materialized (
      select l.* from public.db_activity_log l
      where (p_category is null or l.category = p_category)
        and (p_from is null or l.created_at >= p_from)
        and (p_to is null or l.created_at <= p_to)
        and (nullif(btrim(p_query), '') is null or strpos(lower(concat_ws(' ', l.actor, l.action, l.summary)), lower(btrim(p_query))) > 0)
    ), paged as (
      select * from matched
      order by
        case when p_direction = 'asc' then lower(case p_sort
          when 'category' then category when 'action' then action
          when 'actor' then actor when 'summary' then summary when 'ip' then ip end) end asc nulls last,
        case when p_direction = 'desc' then lower(case p_sort
          when 'category' then category when 'action' then action
          when 'actor' then actor when 'summary' then summary when 'ip' then ip end) end desc nulls last,
        case when p_direction = 'asc' then created_at end asc,
        case when p_direction = 'desc' then created_at end desc,
        case when p_direction = 'asc' then id end asc,
        case when p_direction = 'desc' then id end desc
      limit p_limit offset p_offset
    )
    select jsonb_build_object(
      'data', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb),
      'total', (select count(*) from matched)
    )
  );
end;
$$;
revoke all on function public.db_activity_log_list(text,timestamptz,timestamptz,integer,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.db_activity_log_list(text,timestamptz,timestamptz,integer,integer,text,text,text) to service_role;

create function public.db_activity_log_export(
  p_category text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_query text default null,
  p_direction text default 'desc',
  p_sort text default 'created_at'
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.db_activity_log_list(p_category,p_from,p_to,5000,0,p_query,p_direction,p_sort);
$$;
revoke all on function public.db_activity_log_export(text,timestamptz,timestamptz,text,text,text) from public, anon, authenticated;
grant execute on function public.db_activity_log_export(text,timestamptz,timestamptz,text,text,text) to service_role;
