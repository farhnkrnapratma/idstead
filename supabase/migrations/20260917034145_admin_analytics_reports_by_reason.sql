create or replace function public.db_admin_analytics(p_from timestamptz, p_to timestamptz, p_tz text, p_target text default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with config as (select case when p_to - p_from <= interval '48 hours' then 'hour' else 'day' end as unit),
  buckets as (
    select d as bucket from config, lateral generate_series((p_from - extract(minute from p_from at time zone p_tz) * interval '1 minute' - extract(second from p_from at time zone p_tz) * interval '1 second'),p_to - interval '1 microsecond',interval '1 hour') d where unit = 'hour'
    union all
    select d at time zone p_tz from config, lateral generate_series(date_trunc('day',p_from at time zone p_tz),date_trunc('day',(p_to - interval '1 microsecond') at time zone p_tz),interval '1 day') d where unit = 'day'
  ), reads as (
    select case when unit='hour' then (v.viewed_at - extract(minute from v.viewed_at at time zone p_tz) * interval '1 minute' - extract(second from v.viewed_at at time zone p_tz) * interval '1 second') else date_trunc('day',v.viewed_at at time zone p_tz) at time zone p_tz end as bucket, count(*) as views
    from public.db_views v cross join config where p_target is null and v.viewed_at >= p_from and v.viewed_at < p_to group by 1
  ), feedback as (
    select case when unit='hour' then (f.created_at - extract(minute from f.created_at at time zone p_tz) * interval '1 minute' - extract(second from f.created_at at time zone p_tz) * interval '1 second') else date_trunc('day',f.created_at at time zone p_tz) at time zone p_tz end as bucket,
      count(*) filter(where vote='yes') as helpful, count(*) filter(where vote='no') as unhelpful
    from public.db_feedback_events f cross join config where f.created_at >= p_from and f.created_at < p_to
      and (p_target is null or f.target_type || ':' || f.target_id = p_target) group by 1
  ), reports as (
    select bucket, jsonb_object_agg(reason, cnt) as reasons from (
      select case when unit='hour' then (r.created_at - extract(minute from r.created_at at time zone p_tz) * interval '1 minute' - extract(second from r.created_at at time zone p_tz) * interval '1 second') else date_trunc('day',r.created_at at time zone p_tz) at time zone p_tz end as bucket,
        r.reason, count(*) as cnt
      from public.db_comment_reports r cross join config where p_target is null and r.created_at >= p_from and r.created_at < p_to group by 1,2
    ) x group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('bucket',b.bucket,'views',coalesce(r.views,0),'helpful',coalesce(f.helpful,0),'unhelpful',coalesce(f.unhelpful,0),
    'reports',coalesce(rr.reasons,'{}'::jsonb),
    'partial', b.bucket < p_from or case when unit='hour' then b.bucket + interval '1 hour' else ((b.bucket at time zone p_tz) + interval '1 day') at time zone p_tz end > p_to) order by b.bucket),'[]'::jsonb)
  from buckets b cross join config left join reads r using(bucket) left join feedback f using(bucket) left join reports rr using(bucket);
$$;
