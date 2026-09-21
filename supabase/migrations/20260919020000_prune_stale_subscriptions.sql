create extension if not exists pg_cron;

create or replace function public.db_prune_stale_subscriptions()
returns integer language plpgsql security definer
set search_path = '' as $$
declare
  removed integer;
begin
  delete from public.db_subscribers
  where status = 'pending'
    and created_at < now() - interval '7 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.db_prune_stale_subscriptions()
  from public, anon, authenticated;
grant execute on function public.db_prune_stale_subscriptions() to service_role;

select cron.unschedule('prune-stale-subscriptions')
where exists (
  select 1 from cron.job where jobname = 'prune-stale-subscriptions'
);

select cron.schedule(
  'prune-stale-subscriptions',
  '17 3 * * *',
  $$select public.db_prune_stale_subscriptions()$$
);
