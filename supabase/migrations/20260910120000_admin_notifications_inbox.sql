-- Admin notification inbox: per-item read/dismiss state, replacing the
-- per-kind watermark model in db_admin_seen.

create table if not exists public.db_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'comment_report',
    'comment_new',
    'post_feedback',
    'contact_message',
    'feedback_report'
  )),
  post_id uuid references public.db_posts(id) on delete cascade,
  comment_id uuid references public.db_comments(id) on delete cascade,
  source_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz
);

alter table public.db_admin_notifications enable row level security;

drop policy if exists "admin_notifications_all" on public.db_admin_notifications;
create policy "admin_notifications_all" on public.db_admin_notifications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.db_admin_notifications from public, anon;
grant select, insert, update, delete on public.db_admin_notifications to authenticated;

create index if not exists db_admin_notifications_inbox_idx
  on public.db_admin_notifications (dismissed_at, created_at desc);
create unique index if not exists db_admin_notifications_source_idx
  on public.db_admin_notifications (kind, source_id)
  where source_id is not null;

-- Triggers -------------------------------------------------------------

create or replace function public.db_notify_comment_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.db_admin_notifications (
    kind, post_id, comment_id, source_id, meta, created_at
  )
  select 'comment_report', c.post_id, new.comment_id, new.id,
         jsonb_build_object('reason', new.reason), new.created_at
  from public.db_comments c
  where c.id = new.comment_id
  on conflict (kind, source_id) where source_id is not null do nothing;
  return new;
end;
$$;

create or replace function public.db_notify_comment_new()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_admin, false) then
    return new;
  end if;

  insert into public.db_admin_notifications (
    kind, post_id, comment_id, source_id, meta, created_at
  )
  values (
    'comment_new', new.post_id, new.id, new.id,
    jsonb_build_object(
      'author', case
        when coalesce(new.is_anonymous, false) or new.author_name is null
          then 'Anonymous'
        else new.author_name
      end
    ),
    new.created_at
  )
  on conflict (kind, source_id) where source_id is not null do nothing;
  return new;
end;
$$;

create or replace function public.db_notify_post_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.db_admin_notifications (
    kind, post_id, source_id, meta, created_at
  )
  values (
    'post_feedback', new.post_id, new.id,
    jsonb_build_object('vote', new.vote), new.created_at
  )
  on conflict (kind, source_id) where source_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists trg_notify_comment_report on public.db_comment_reports;
create trigger trg_notify_comment_report
  after insert on public.db_comment_reports
  for each row execute function public.db_notify_comment_report();

drop trigger if exists trg_notify_comment_new on public.db_comments;
create trigger trg_notify_comment_new
  after insert on public.db_comments
  for each row execute function public.db_notify_comment_new();

drop trigger if exists trg_notify_post_feedback on public.db_post_feedback;
create trigger trg_notify_post_feedback
  after insert on public.db_post_feedback
  for each row execute function public.db_notify_post_feedback();

-- Backfill, preserving the read state implied by the old watermark -------

insert into public.db_admin_notifications (
  kind, post_id, comment_id, source_id, meta, created_at, read_at
)
select 'comment_report', c.post_id, r.comment_id, r.id,
       jsonb_build_object('reason', r.reason), r.created_at,
       case
         when s.seen_at is null or r.created_at > s.seen_at then null
         else now()
       end
from public.db_comment_reports r
join public.db_comments c on c.id = r.comment_id
left join public.db_admin_seen s on s.kind = 'comment_reports'
on conflict (kind, source_id) where source_id is not null do nothing;

insert into public.db_admin_notifications (
  kind, post_id, source_id, meta, created_at, read_at
)
select 'post_feedback', f.post_id, f.id,
       jsonb_build_object('vote', f.vote), f.created_at,
       case
         when s.seen_at is null or f.created_at > s.seen_at then null
         else now()
       end
from public.db_post_feedback f
left join public.db_admin_seen s on s.kind = 'post_feedback'
on conflict (kind, source_id) where source_id is not null do nothing;

-- Existing comments predate the notification feature: seed them as read so
-- the inbox does not open with the entire comment history unread.
insert into public.db_admin_notifications (
  kind, post_id, comment_id, source_id, meta, created_at, read_at
)
select 'comment_new', c.post_id, c.id, c.id,
       jsonb_build_object(
         'author', case
           when coalesce(c.is_anonymous, false) or c.author_name is null
             then 'Anonymous'
           else c.author_name
         end
       ),
       c.created_at, now()
from public.db_comments c
where not coalesce(c.is_admin, false)
on conflict (kind, source_id) where source_id is not null do nothing;

drop table if exists public.db_admin_seen;

-- Realtime: the bell subscribes to this table so new events appear without
-- a page refresh.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.db_admin_notifications;
  end if;
exception when duplicate_object then
  null;
end;
$$;

revoke all on function public.db_notify_comment_report() from public, anon, authenticated;
revoke all on function public.db_notify_comment_new() from public, anon, authenticated;
revoke all on function public.db_notify_post_feedback() from public, anon, authenticated;
grant all on public.db_admin_notifications to service_role;
