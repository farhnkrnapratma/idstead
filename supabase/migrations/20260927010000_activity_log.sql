create table if not exists public.db_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text not null,
  category text not null
    check (category in ('profile', 'cv', 'skills', 'links', 'blog', 'auth', 'security')),
  entity_id text,
  summary text not null,
  details jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists db_activity_log_created_idx
  on public.db_activity_log (created_at desc);

create index if not exists db_activity_log_category_idx
  on public.db_activity_log (category);

alter table public.db_activity_log enable row level security;

revoke all on public.db_activity_log from anon, authenticated;

create or replace function public.db_activity_log_list(
  p_category text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  actor text,
  action text,
  category text,
  entity_id text,
  summary text,
  details jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer
set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required';
  end if;

  return query
    select
      l.id, l.actor, l.action, l.category, l.entity_id, l.summary,
      l.details, l.ip_hash, l.user_agent, l.created_at,
      count(*) over () as total_count
    from public.db_activity_log l
    where (p_category is null or l.category = p_category)
      and (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at <= p_to)
    order by l.created_at desc
    limit least(coalesce(p_limit, 50), 200)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.db_activity_log_list(text, timestamptz, timestamptz, integer, integer)
  from public, anon, authenticated;
grant execute on function public.db_activity_log_list(text, timestamptz, timestamptz, integer, integer)
  to authenticated, service_role;

create or replace function public.db_activity_log_export(
  p_category text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid,
  actor text,
  action text,
  category text,
  entity_id text,
  summary text,
  details jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz
)
language plpgsql stable security definer
set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required';
  end if;

  return query
    select
      l.id, l.actor, l.action, l.category, l.entity_id, l.summary,
      l.details, l.ip_hash, l.user_agent, l.created_at
    from public.db_activity_log l
    where (p_category is null or l.category = p_category)
      and (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at <= p_to)
    order by l.created_at desc
    limit 5000;
end;
$$;

revoke all on function public.db_activity_log_export(text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.db_activity_log_export(text, timestamptz, timestamptz)
  to authenticated, service_role;

create extension if not exists pg_cron;

create or replace function public.db_prune_activity_log()
returns integer language plpgsql security definer
set search_path = '' as $$
declare
  removed integer;
begin
  delete from public.db_activity_log where created_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.db_prune_activity_log()
  from public, anon, authenticated;
grant execute on function public.db_prune_activity_log() to service_role;

select cron.unschedule('prune-activity-log')
where exists (
  select 1 from cron.job where jobname = 'prune-activity-log'
);

select cron.schedule(
  'prune-activity-log',
  '31 3 * * *',
  $$select public.db_prune_activity_log()$$
);
