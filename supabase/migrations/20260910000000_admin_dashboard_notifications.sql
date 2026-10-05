create table if not exists public.db_admin_seen (
  kind text primary key check (kind in ('comment_reports', 'post_feedback')),
  seen_at timestamptz not null default now()
);

alter table public.db_admin_seen enable row level security;

drop policy if exists "admin_seen_all" on public.db_admin_seen;
create policy "admin_seen_all" on public.db_admin_seen
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "post_feedback_admin_select" on public.db_post_feedback;
create policy "post_feedback_admin_select" on public.db_post_feedback
  for select to authenticated
  using (public.is_admin());

create or replace function public.db_views_timeseries(
  p_since timestamptz,
  p_bucket text default 'day',
  p_tz text default 'UTC'
)
returns table (bucket timestamp, views bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_unit text := case when p_bucket = 'hour' then 'hour' else 'day' end;
  v_tz text := coalesce(p_tz, 'UTC');
  v_since timestamptz := greatest(
    coalesce(p_since, now() - interval '30 days'),
    now() - interval '400 days'
  );
begin
  begin
    perform now() at time zone v_tz;
  exception when invalid_parameter_value or invalid_datetime_format then
    v_tz := 'UTC';
  end;

  return query
  select date_trunc(v_unit, v.viewed_at at time zone v_tz),
         count(*)::bigint
  from public.db_views v
  where v.viewed_at >= v_since
  group by 1
  order by 1;
end;
$$;

revoke all on function public.db_views_timeseries(timestamptz, text, text) from public, anon;
grant execute on function public.db_views_timeseries(timestamptz, text, text) to authenticated, service_role;

revoke all on public.db_admin_seen from public, anon;
grant select, insert, update, delete on public.db_admin_seen to authenticated;

revoke select on public.db_post_feedback from authenticated;
revoke select (ip_hash) on public.db_post_feedback from authenticated;
grant select (id, post_id, vote, created_at) on public.db_post_feedback to authenticated;

create index if not exists db_comment_reports_comment_id_idx
  on public.db_comment_reports (comment_id);
create index if not exists db_views_viewed_at_idx
  on public.db_views (viewed_at desc);
create index if not exists db_post_feedback_created_at_idx
  on public.db_post_feedback (created_at desc);
