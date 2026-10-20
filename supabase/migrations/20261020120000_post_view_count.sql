alter table public.db_posts
  add column view_count integer not null default 0 check (view_count >= 0);

update public.db_posts p
  set view_count = (select count(*) from public.db_views v where v.post_id = p.id)
  where p.id is not null;

create unique index db_views_post_id_ip_hash_key on public.db_views (post_id, ip_hash);

create function public.db_sync_post_view_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.db_posts set view_count = view_count + 1 where id = new.post_id;
    return new;
  end if;
  update public.db_posts set view_count = greatest(view_count - 1, 0) where id = old.post_id;
  return old;
end;
$$;

revoke all on function public.db_sync_post_view_count() from public, anon, authenticated;

create trigger db_views_sync_post_view_count
  after insert or delete on public.db_views
  for each row execute function public.db_sync_post_view_count();
