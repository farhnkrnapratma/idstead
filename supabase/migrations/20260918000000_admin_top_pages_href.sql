create or replace function public.db_admin_top_pages()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with most_read as (
    select p.title as page, '/blog/' || p.slug as href, v.views as value
    from (select post_id, count(*) as views from public.db_views group by post_id) v
    join public.db_posts p on p.id = v.post_id
    order by v.views desc limit 1
  ), feedback_totals as (
    select target_type, target_id, max(page_title) as title, count(*) as total,
      count(*) filter (where vote = 'yes') as helpful, count(*) filter (where vote = 'no') as unhelpful
    from public.db_feedback_events group by target_type, target_id having count(*) >= 3
  ), most_helpful as (
    select coalesce(p.title, l.title, f.title) as page,
      case when p.slug is not null then '/blog/' || p.slug when l.slug is not null then '/' || l.slug end as href,
      round(f.helpful::numeric / f.total * 100)::int as value
    from feedback_totals f
    left join public.db_posts p on f.target_type = 'article' and p.id::text = f.target_id
    left join public.db_legals l on f.target_type = 'legal' and l.slug = f.target_id
    order by f.helpful::numeric / f.total desc limit 1
  ), most_unhelpful as (
    select coalesce(p.title, l.title, f.title) as page,
      case when p.slug is not null then '/blog/' || p.slug when l.slug is not null then '/' || l.slug end as href,
      round(f.unhelpful::numeric / f.total * 100)::int as value
    from feedback_totals f
    left join public.db_posts p on f.target_type = 'article' and p.id::text = f.target_id
    left join public.db_legals l on f.target_type = 'legal' and l.slug = f.target_id
    order by f.unhelpful::numeric / f.total desc limit 1
  ), most_responses as (
    select coalesce(p.title, l.title, f.title) as page,
      case when p.slug is not null then '/blog/' || p.slug when l.slug is not null then '/' || l.slug end as href,
      f.total as value
    from feedback_totals f
    left join public.db_posts p on f.target_type = 'article' and p.id::text = f.target_id
    left join public.db_legals l on f.target_type = 'legal' and l.slug = f.target_id
    order by f.total desc limit 1
  ), most_commented as (
    select p.title as page, '/blog/' || p.slug as href, c.total as value
    from (select post_id, count(*) as total from public.db_comments group by post_id) c
    join public.db_posts p on p.id = c.post_id
    order by c.total desc limit 1
  ), most_reported as (
    select p.title as page, '/blog/' || p.slug as href, r.total as value
    from (
      select c.post_id, count(*) as total
      from public.db_comment_reports rep
      join public.db_comments c on c.id = rep.comment_id
      group by c.post_id
    ) r
    join public.db_posts p on p.id = r.post_id
    order by r.total desc limit 1
  )
  select coalesce(jsonb_agg(row), '[]'::jsonb) from (
    select 'Most read' as metric, page, href, value::text || ' ' || (case when value = 1 then 'view' else 'views' end) as value from most_read
    union all
    select 'Most helpful', page, href, value::text || '% helpful' from most_helpful
    union all
    select 'Most unhelpful', page, href, value::text || '% unhelpful' from most_unhelpful
    union all
    select 'Most responses', page, href, value::text || ' ' || (case when value = 1 then 'response' else 'responses' end) from most_responses
    union all
    select 'Most commented', page, href, value::text || ' ' || (case when value = 1 then 'comment' else 'comments' end) from most_commented
    union all
    select 'Most reported', page, href, value::text || ' ' || (case when value = 1 then 'report' else 'reports' end) from most_reported
  ) row;
$$;
