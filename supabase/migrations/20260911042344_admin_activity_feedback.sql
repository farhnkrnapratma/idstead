create table public.db_feedback_events (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('article', 'legal')),
  target_id text not null,
  post_id uuid references public.db_posts(id) on delete set null,
  page_title text not null,
  vote text not null check (vote in ('yes', 'no')),
  ip_hash text not null,
  created_at timestamptz not null default now(),
  legacy_id uuid unique
);

create index db_feedback_events_quota_idx
  on public.db_feedback_events (target_type, target_id, ip_hash, created_at desc);
create index db_feedback_events_page_idx
  on public.db_feedback_events (target_type, target_id, created_at desc, id desc);

create table public.db_feedback_operations (
  operation_id uuid primary key,
  target_type text not null check (target_type in ('article', 'legal')),
  target_id text not null,
  vote text not null check (vote in ('yes', 'no')),
  ip_hash text not null,
  recorded boolean not null,
  event_id uuid references public.db_feedback_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.db_notification_clear_operations (
  operation_id uuid primary key,
  actor_id uuid not null,
  target_ids uuid[] not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_count integer
);

alter table public.db_feedback_events enable row level security;
alter table public.db_feedback_operations enable row level security;
alter table public.db_notification_clear_operations enable row level security;
revoke all on public.db_feedback_events, public.db_feedback_operations,
  public.db_notification_clear_operations from public, anon, authenticated;
grant select, insert, update, delete on public.db_feedback_events,
  public.db_feedback_operations, public.db_notification_clear_operations to service_role;

insert into public.db_feedback_events
  (id, target_type, target_id, post_id, page_title, vote, ip_hash, created_at, legacy_id)
select f.id, 'article', f.post_id::text, f.post_id, p.title,
       f.vote, f.ip_hash, f.created_at, f.id
from public.db_post_feedback f join public.db_posts p on p.id = f.post_id;

alter table public.db_admin_notifications
  drop constraint db_admin_notifications_kind_check,
  add constraint db_admin_notifications_kind_check check (kind in (
    'comment_report', 'comment_new', 'post_feedback', 'legal_feedback',
    'contact_message', 'feedback_report'
  )),
  drop constraint db_admin_notifications_post_id_fkey,
  add constraint db_admin_notifications_post_id_fkey
    foreign key (post_id) references public.db_posts(id) on delete set null,
  drop constraint db_admin_notifications_comment_id_fkey,
  add constraint db_admin_notifications_comment_id_fkey
    foreign key (comment_id) references public.db_comments(id) on delete set null;

update public.db_admin_notifications n
set meta = n.meta || jsonb_build_object(
  'page_type', 'article', 'page_id', p.id::text, 'page_title', p.title
)
from public.db_posts p where p.id = n.post_id;

update public.db_admin_notifications n
set meta = n.meta || jsonb_build_object(
  'author', case when c.is_anonymous or c.author_name is null then 'Anonymous' else c.author_name end,
  'comment', c.content
)
from public.db_comments c where c.id = n.comment_id;

update public.db_admin_notifications n
set meta = n.meta || jsonb_build_object('details', r.details)
from public.db_comment_reports r where n.kind = 'comment_report' and n.source_id = r.id;

create or replace function public.db_notify_comment_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.db_admin_notifications (kind, post_id, comment_id, source_id, meta, created_at)
  select 'comment_report', c.post_id, c.id, new.id,
    jsonb_build_object('reason', new.reason, 'details', new.details,
      'author', case when c.is_anonymous or c.author_name is null then 'Anonymous' else c.author_name end,
      'comment', c.content, 'page_type', 'article', 'page_id', p.id::text, 'page_title', p.title),
    new.created_at
  from public.db_comments c join public.db_posts p on p.id = c.post_id
  where c.id = new.comment_id
  on conflict (kind, source_id) where source_id is not null do nothing;
  return new;
end;
$$;

create or replace function public.db_notify_comment_new()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.is_admin, false) then return new; end if;
  insert into public.db_admin_notifications (kind, post_id, comment_id, source_id, meta, created_at)
  select 'comment_new', new.post_id, new.id, new.id,
    jsonb_build_object(
      'author', case when new.is_anonymous or new.author_name is null then 'Anonymous' else new.author_name end,
      'comment', new.content, 'page_type', 'article', 'page_id', p.id::text, 'page_title', p.title),
    new.created_at
  from public.db_posts p where p.id = new.post_id
  on conflict (kind, source_id) where source_id is not null do nothing;
  return new;
end;
$$;

create function public.db_notify_page_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.db_admin_notifications (kind, post_id, source_id, meta, created_at)
  values (case when new.target_type = 'article' then 'post_feedback' else 'legal_feedback' end,
    new.post_id, new.id,
    jsonb_build_object('vote', new.vote, 'page_type', new.target_type,
      'page_id', new.target_id, 'page_title', new.page_title), new.created_at)
  on conflict (kind, source_id) where source_id is not null do nothing;
  return new;
end;
$$;

create trigger trg_notify_page_feedback after insert on public.db_feedback_events
  for each row execute function public.db_notify_page_feedback();

create or replace function public.db_notify_post_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.db_feedback_events
    (id, target_type, target_id, post_id, page_title, vote, ip_hash, created_at, legacy_id)
  select new.id, 'article', new.post_id::text, new.post_id, p.title,
    new.vote, new.ip_hash, new.created_at, new.id
  from public.db_posts p where p.id = new.post_id
  on conflict (id) do nothing;
  return new;
end;
$$;

create function public.db_record_page_feedback(
  p_operation_id uuid, p_target_type text, p_target_id text, p_vote text, p_ip_hash text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_operation public.db_feedback_operations%rowtype;
  v_title text;
  v_post_id uuid;
  v_event_id uuid;
  v_now timestamptz;
begin
  if p_operation_id is null or p_target_type is null or p_target_type not in ('article', 'legal')
    or p_target_id is null or length(p_target_id) > 80 or p_vote is null or p_vote not in ('yes', 'no')
    or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'FEEDBACK_INVALID' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('feedback-operation:' || p_operation_id::text, 0));
  select * into v_operation from public.db_feedback_operations where operation_id = p_operation_id;
  if found then
    if (v_operation.target_type, v_operation.target_id, v_operation.vote, v_operation.ip_hash)
      is distinct from (p_target_type, p_target_id, p_vote, p_ip_hash) then
      raise exception 'FEEDBACK_OPERATION_CONFLICT' using errcode = '22023';
    end if;
    return jsonb_build_object('recorded', v_operation.recorded, 'replayed', true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('feedback-quota:' || p_target_type || ':' || p_target_id || ':' || p_ip_hash, 0));
  if p_target_type = 'article' then
    select id, title into v_post_id, v_title from public.db_posts
      where id::text = p_target_id and published and nullif(slug, '') is not null for update;
  else
    select title into v_title from public.db_legals
      where slug = p_target_id and slug in ('privacy', 'security', 'terms') and length(trim(content)) > 0 for share;
  end if;
  if v_title is null then raise exception 'FEEDBACK_TARGET_NOT_FOUND' using errcode = 'P0002'; end if;
  v_now := clock_timestamp();
  if exists (select 1 from public.db_feedback_events
    where target_type = p_target_type and target_id = p_target_id and ip_hash = p_ip_hash
      and created_at > v_now - interval '24 hours') then
    insert into public.db_feedback_operations
      (operation_id, target_type, target_id, vote, ip_hash, recorded, created_at)
    values (p_operation_id, p_target_type, p_target_id, p_vote, p_ip_hash, false, v_now);
    return jsonb_build_object('recorded', false, 'replayed', false);
  end if;
  v_event_id := gen_random_uuid();
  insert into public.db_feedback_events
    (id, target_type, target_id, post_id, page_title, vote, ip_hash, created_at, legacy_id)
  values (v_event_id, p_target_type, p_target_id, v_post_id, v_title, p_vote, p_ip_hash, v_now,
    case when v_post_id is not null then v_event_id end);
  if v_post_id is not null then
    insert into public.db_post_feedback (id, post_id, vote, ip_hash, created_at)
      values (v_event_id, v_post_id, p_vote, p_ip_hash, v_now);
    update public.db_posts set
      helpful_yes = coalesce(helpful_yes, 0) + case when p_vote = 'yes' then 1 else 0 end,
      helpful_no = coalesce(helpful_no, 0) + case when p_vote = 'no' then 1 else 0 end
    where id = v_post_id;
  end if;
  insert into public.db_feedback_operations
    (operation_id, target_type, target_id, vote, ip_hash, recorded, event_id, created_at)
  values (p_operation_id, p_target_type, p_target_id, p_vote, p_ip_hash, true, v_event_id, v_now);
  return jsonb_build_object('recorded', true, 'replayed', false);
end;
$$;

alter table public.db_post_feedback drop constraint db_post_feedback_unique;

create or replace function public.record_post_feedback(p_post_id uuid, p_vote text, p_ip_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  return (public.db_record_page_feedback(gen_random_uuid(), 'article', p_post_id::text, p_vote, p_ip_hash)->>'recorded')::boolean;
end;
$$;

revoke all on function public.record_post_feedback(uuid, text, text) from public;
grant execute on function public.record_post_feedback(uuid, text, text) to anon, authenticated, service_role;
revoke all on function public.db_notify_page_feedback() from public, anon, authenticated;
revoke all on function public.db_record_page_feedback(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.db_record_page_feedback(uuid, text, text, text, text) to service_role;

create view public.db_admin_notification_items with (security_invoker = true) as
select n.id, n.kind, n.post_id, n.comment_id, n.source_id, n.meta, n.created_at, n.read_at,
  coalesce(n.meta->>'page_type', case when n.post_id is not null then 'article' end) as page_type,
  coalesce(n.meta->>'page_id', n.post_id::text) as page_id,
  coalesce(p.title, l.title, n.meta->>'page_title') as page_title,
  case when p.published and nullif(p.slug, '') is not null then '/blog/' || p.slug
    when l.slug in ('privacy', 'security', 'terms') and length(trim(l.content)) > 0 then '/' || l.slug end as page_url,
  case when n.kind = 'comment_report' then case when r.id is null then 'resolved' else 'open' end end as report_status,
  case n.kind when 'comment_report' then 'Report' when 'comment_new' then 'Comment'
    when 'contact_message' then 'Contact message' when 'feedback_report' then 'Feedback form'
    else case when n.meta->>'vote' = 'yes' then 'Helpful' else 'Unhelpful' end end as type_label
from public.db_admin_notifications n
left join public.db_posts p on p.id = n.post_id
left join public.db_legals l on n.kind = 'legal_feedback' and l.slug = n.meta->>'page_id'
left join public.db_comment_reports r on n.kind = 'comment_report' and r.id = n.source_id
where n.dismissed_at is null;

revoke all on public.db_admin_notification_items from public, anon, authenticated;
grant select on public.db_admin_notification_items to service_role;

create function public.db_admin_inbox(
  p_query text default '', p_type text default 'all', p_read text default 'all',
  p_sort text default 'date', p_direction text default 'desc', p_cursor jsonb default null
)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if length(p_query) > 200 or p_sort not in ('date', 'type', 'page') or p_direction not in ('asc', 'desc')
    or p_read not in ('all', 'read', 'unread') or p_type not in ('all', 'comment_report', 'comment_new', 'helpful', 'unhelpful', 'contact_message', 'feedback_report') then
    raise exception 'INBOX_FILTER_INVALID' using errcode = '22023';
  end if;
  with filtered as (
    select n.*, case p_sort when 'type' then lower(n.type_label) when 'page' then lower(coalesce(n.page_title, '')) else '' end collate "C" as sort_value
    from public.db_admin_notification_items n
    where (p_read = 'all' or (p_read = 'read') = (n.read_at is not null))
      and (p_type = 'all' or n.kind = p_type
        or (p_type = 'helpful' and n.kind in ('post_feedback', 'legal_feedback') and n.meta->>'vote' = 'yes')
        or (p_type = 'unhelpful' and n.kind in ('post_feedback', 'legal_feedback') and n.meta->>'vote' = 'no'))
      and (p_query = '' or position(lower(p_query) in lower(concat_ws(' ', n.page_title, n.type_label,
        n.meta->>'author', n.meta->>'comment', n.meta->>'reason', n.meta->>'details'))) > 0)
  ), remaining as (
    select * from filtered n where p_cursor is null or
      (p_sort = 'date' and case when p_direction = 'asc' then
        (n.created_at, n.id) > ((p_cursor->>'date')::timestamptz, (p_cursor->>'id')::uuid)
      else (n.created_at, n.id) < ((p_cursor->>'date')::timestamptz, (p_cursor->>'id')::uuid) end)
      or (p_sort <> 'date' and (
        case when p_direction = 'asc' then n.sort_value > (p_cursor->>'value') collate "C"
          else n.sort_value < (p_cursor->>'value') collate "C" end
        or (n.sort_value = (p_cursor->>'value') collate "C" and
          (n.created_at, n.id) < ((p_cursor->>'date')::timestamptz, (p_cursor->>'id')::uuid))))
  ), ordered as (
    select *, row_number() over (order by
      case when p_direction = 'asc' then sort_value end asc,
      case when p_direction = 'desc' then sort_value end desc,
      case when p_sort = 'date' and p_direction = 'asc' then created_at end asc,
      case when not (p_sort = 'date' and p_direction = 'asc') then created_at end desc,
      case when p_sort = 'date' and p_direction = 'asc' then id end asc,
      id desc) as position
    from remaining
  ), page as (select * from ordered order by position limit 21)
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(x) - 'position' - 'sort_value' order by position) from page x where position <= 20), '[]'::jsonb),
    'nextCursor', case when (select count(*) from page) > 20 then
      (select jsonb_build_object('value', sort_value, 'date', created_at, 'id', id) from page where position = 20) end,
    'total', (select count(*) from filtered),
    'unreadCount', (select count(*) from public.db_admin_notifications where dismissed_at is null and read_at is null)
  ) into v_result;
  return v_result;
end;
$$;

create function public.db_admin_clear_notifications(p_actor_id uuid, p_operation_id uuid, p_confirm boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_operation public.db_notification_clear_operations%rowtype; v_count integer;
begin
  if p_actor_id is null or p_operation_id is null then raise exception 'CLEAR_INVALID' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clear-notifications:' || p_operation_id::text, 0));
  select * into v_operation from public.db_notification_clear_operations where operation_id = p_operation_id;
  if found and v_operation.actor_id <> p_actor_id then raise exception 'CLEAR_OPERATION_CONFLICT' using errcode = '22023'; end if;
  if not found then
    if p_confirm then raise exception 'CLEAR_NOT_PREPARED' using errcode = '22023'; end if;
    insert into public.db_notification_clear_operations(operation_id, actor_id, target_ids)
      select p_operation_id, p_actor_id, coalesce(array_agg(id), '{}'::uuid[]) from public.db_admin_notifications
      returning * into v_operation;
  end if;
  if p_confirm and v_operation.completed_at is null then
    delete from public.db_admin_notifications where id = any(v_operation.target_ids);
    get diagnostics v_count = row_count;
    update public.db_notification_clear_operations set completed_at = clock_timestamp(), deleted_count = v_count
      where operation_id = p_operation_id returning * into v_operation;
  end if;
  return jsonb_build_object('operationId', p_operation_id, 'count', cardinality(v_operation.target_ids),
    'completed', v_operation.completed_at is not null, 'deletedCount', v_operation.deleted_count);
end;
$$;

create function public.db_admin_dashboard()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'helpful', (select count(*) from public.db_feedback_events where vote = 'yes'),
    'unhelpful', (select count(*) from public.db_feedback_events where vote = 'no'),
    'openReports', (select count(*) from public.db_comment_reports),
    'reportedComments', (select count(distinct comment_id) from public.db_comment_reports),
    'published', (select count(*) from public.db_posts where published),
    'posts', (select count(*) from public.db_posts)
  );
$$;

create view public.db_admin_feedback_items with (security_invoker = true) as
select f.id, f.target_type, f.target_id, f.vote, f.created_at,
  coalesce(p.title, l.title, f.page_title) as page_title,
  case when p.published and nullif(p.slug, '') is not null then '/blog/' || p.slug
    when l.slug in ('privacy', 'security', 'terms') and length(trim(l.content)) > 0 then '/' || l.slug end as page_url
from public.db_feedback_events f
left join public.db_posts p on p.id = f.post_id
left join public.db_legals l on f.target_type = 'legal' and l.slug = f.target_id;

revoke all on public.db_admin_feedback_items from public, anon, authenticated;
grant select on public.db_admin_feedback_items to service_role;

create function public.db_admin_feedback_groups(p_offset integer default 0, p_target_type text default null, p_target_id text default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with grouped as (
    select target_type, target_id, (array_agg(page_title order by created_at desc, id desc))[1] as page_title,
      (array_agg(page_url order by created_at desc, id desc))[1] as page_url,
      count(*) filter (where vote = 'yes') as helpful, count(*) filter (where vote = 'no') as unhelpful,
      max(created_at) as latest
    from public.db_admin_feedback_items group by target_type, target_id
  ), ranked as (
    select *, row_number() over (order by latest desc, target_type, target_id) - 1 as position from grouped
  ), location as (
    select case when p_target_id is not null then coalesce((select (position / 10)::integer * 10 from ranked
      where target_type = p_target_type and target_id = p_target_id), 0) else greatest(p_offset, 0) end as start
  )
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(x) - 'position' order by position)
    from ranked x, location where position >= start and position < start + 10), '[]'::jsonb),
    'offset', (select start from location), 'total', (select count(*) from grouped), 'pageSize', 10);
$$;

create function public.db_admin_feedback_history(p_target_type text, p_target_id text, p_offset integer default 0, p_focus_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with ranked as (
    select *, row_number() over (order by created_at desc, id desc) - 1 as position
    from public.db_admin_feedback_items where target_type = p_target_type and target_id = p_target_id
  ), location as (
    select case when p_focus_id is not null then coalesce((select (position / 20)::integer * 20 from ranked
      where id = p_focus_id), 0) else greatest(p_offset, 0) end as start
  )
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(x) - 'position' order by position)
    from ranked x, location where position >= start and position < start + 20), '[]'::jsonb),
    'offset', (select start from location), 'total', (select count(*) from ranked), 'pageSize', 20);
$$;

create view public.db_admin_report_items with (security_invoker = true) as
select r.id, r.reason, r.details, r.created_at, c.id as comment_id, c.post_id, c.content,
  case when c.is_anonymous or c.author_name is null then 'Anonymous' else c.author_name end as author,
  p.title as page_title, case when p.published and nullif(p.slug, '') is not null then '/blog/' || p.slug end as page_url
from public.db_comment_reports r join public.db_comments c on c.id = r.comment_id
join public.db_posts p on p.id = c.post_id;

revoke all on public.db_admin_report_items from public, anon, authenticated;
grant select on public.db_admin_report_items to service_role;

create function public.db_admin_report_groups(p_post_id uuid default null, p_offset integer default 0, p_focus_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with grouped as (
    select case when p_post_id is null then post_id else comment_id end as id,
      max(post_id::text)::uuid as post_id, max(page_title) as page_title, max(page_url) as page_url,
      case when p_post_id is not null then max(author) end as author,
      case when p_post_id is not null then max(content) end as content,
      count(*) as reports, count(distinct comment_id) as comments, max(created_at) as latest,
      bool_or(id = p_focus_id) as has_focus
    from public.db_admin_report_items where p_post_id is null or post_id = p_post_id
    group by case when p_post_id is null then post_id else comment_id end
  ), ranked as (
    select *, row_number() over (order by latest desc, id desc) - 1 as position from grouped
  ), location as (
    select case when p_focus_id is not null then coalesce((select (position / 10)::integer * 10 from ranked where has_focus), 0)
      else greatest(p_offset, 0) end as start
  )
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(x) - 'position' - 'has_focus' order by position)
    from ranked x, location where position >= start and position < start + 10), '[]'::jsonb),
    'offset', (select start from location), 'total', (select count(*) from grouped), 'pageSize', 10);
$$;

create function public.db_admin_report_history(p_comment_id uuid, p_reason text default null, p_offset integer default 0, p_focus_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with ranked as (
    select *, row_number() over (order by created_at desc, id desc) - 1 as position
    from public.db_admin_report_items where comment_id = p_comment_id and (p_reason is null or reason = p_reason)
  ), location as (
    select case when p_focus_id is not null then coalesce((select (position / 20)::integer * 20 from ranked where id = p_focus_id), 0)
      else greatest(p_offset, 0) end as start
  )
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(x) - 'position' order by position)
    from ranked x, location where position >= start and position < start + 20), '[]'::jsonb),
    'reasons', coalesce((select jsonb_agg(x order by latest desc, reason) from (
      select reason, count(*) as count, max(created_at) as latest from public.db_admin_report_items
      where comment_id = p_comment_id group by reason) x), '[]'::jsonb),
    'offset', (select start from location), 'total', (select count(*) from ranked), 'pageSize', 20);
$$;

revoke all on function public.db_admin_inbox(text, text, text, text, text, jsonb),
  public.db_admin_clear_notifications(uuid, uuid, boolean), public.db_admin_dashboard(),
  public.db_admin_feedback_groups(integer, text, text), public.db_admin_feedback_history(text, text, integer, uuid),
  public.db_admin_report_groups(uuid, integer, uuid), public.db_admin_report_history(uuid, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.db_admin_inbox(text, text, text, text, text, jsonb),
  public.db_admin_clear_notifications(uuid, uuid, boolean), public.db_admin_dashboard(),
  public.db_admin_feedback_groups(integer, text, text), public.db_admin_feedback_history(text, text, integer, uuid),
  public.db_admin_report_groups(uuid, integer, uuid), public.db_admin_report_history(uuid, text, integer, uuid)
  to service_role;
