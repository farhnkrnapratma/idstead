create table if not exists public.db_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'unsubscribed')),
  confirm_token_hash text,
  unsubscribe_token_hash text not null,
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists db_subscribers_email_key
  on public.db_subscribers (lower(email));

create unique index if not exists db_subscribers_confirm_token_key
  on public.db_subscribers (confirm_token_hash)
  where confirm_token_hash is not null;

create unique index if not exists db_subscribers_unsubscribe_token_key
  on public.db_subscribers (unsubscribe_token_hash);

create index if not exists db_subscribers_active_idx
  on public.db_subscribers (status)
  where status = 'active';

alter table public.db_subscribers enable row level security;

revoke all on public.db_subscribers from anon, authenticated;

alter table public.db_posts
  add column if not exists subscribers_notified_at timestamptz;

create or replace function public.db_subscriber_stats()
returns jsonb language plpgsql stable security definer
set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required';
  end if;

  return (
    select jsonb_build_object(
      'active', count(*) filter (where status = 'active'),
      'pending', count(*) filter (where status = 'pending'),
      'unsubscribed', count(*) filter (where status = 'unsubscribed')
    )
    from public.db_subscribers
  );
end;
$$;

revoke all on function public.db_subscriber_stats() from public, anon;
grant execute on function public.db_subscriber_stats() to authenticated, service_role;
