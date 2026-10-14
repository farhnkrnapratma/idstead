create table if not exists public.db_login_failures (
  id bigint generated always as identity primary key,
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  failed_at timestamptz not null default now()
);

create index if not exists db_login_failures_key_hash_failed_at_idx
  on public.db_login_failures (key_hash, failed_at);

create index if not exists db_login_failures_failed_at_idx
  on public.db_login_failures (failed_at);

alter table public.db_login_failures enable row level security;

revoke all on table public.db_login_failures from public, anon, authenticated;

create or replace function public.db_login_valid_keys(p_keys text[])
returns text[] language plpgsql immutable
set search_path = '' as $$
begin
  if p_keys is null
    or cardinality(p_keys) not between 1 and 4
    or exists (select 1 from unnest(p_keys) as key where key is null or key !~ '^[0-9a-f]{64}$')
  then
    raise exception 'Invalid login lockout keys.' using errcode = '22023';
  end if;
  return p_keys;
end;
$$;

create or replace function public.db_login_lockout(p_keys text[])
returns integer language plpgsql stable security definer
set search_path = '' as $$
declare
  wait integer := 0;
  oldest timestamptz;
begin
  for oldest in
    select min(failure.failed_at)
    from public.db_login_failures as failure
    where failure.key_hash = any(public.db_login_valid_keys(p_keys))
      and failure.failed_at > now() - interval '15 minutes'
    group by failure.key_hash
    having count(*) >= 5
  loop
    wait := greatest(
      wait,
      1,
      ceil(extract(epoch from oldest + interval '15 minutes' - now()))::integer
    );
  end loop;
  return wait;
end;
$$;

create or replace function public.db_login_record_failure(p_keys text[])
returns void language plpgsql security definer
set search_path = '' as $$
begin
  delete from public.db_login_failures
  where key_hash = any(public.db_login_valid_keys(p_keys))
    and failed_at <= now() - interval '15 minutes';
  insert into public.db_login_failures (key_hash)
  select distinct key from unnest(p_keys) as key;
end;
$$;

create or replace function public.db_login_clear(p_keys text[])
returns void language plpgsql security definer
set search_path = '' as $$
begin
  delete from public.db_login_failures
  where key_hash = any(public.db_login_valid_keys(p_keys));
end;
$$;

create or replace function public.db_prune_login_failures()
returns integer language plpgsql security definer
set search_path = '' as $$
declare
  removed integer;
begin
  delete from public.db_login_failures
  where failed_at < now() - interval '1 day';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.db_login_valid_keys(text[]) from public, anon, authenticated;
revoke all on function public.db_login_lockout(text[]) from public, anon, authenticated;
revoke all on function public.db_login_record_failure(text[]) from public, anon, authenticated;
revoke all on function public.db_login_clear(text[]) from public, anon, authenticated;
revoke all on function public.db_prune_login_failures() from public, anon, authenticated;
grant execute on function public.db_login_valid_keys(text[]) to service_role;
grant execute on function public.db_login_lockout(text[]) to service_role;
grant execute on function public.db_login_record_failure(text[]) to service_role;
grant execute on function public.db_login_clear(text[]) to service_role;
grant execute on function public.db_prune_login_failures() to service_role;

select cron.unschedule('prune-login-failures')
where exists (
  select 1 from cron.job where jobname = 'prune-login-failures'
);

select cron.schedule(
  'prune-login-failures',
  '37 * * * *',
  $$select public.db_prune_login_failures()$$
);
