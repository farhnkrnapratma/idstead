do $$
declare
  v_target_ids text[];
  v_target_id text;
begin
  select array_agg(distinct candidate.target_id) into v_target_ids
  from (
    select f.target_id
    from public.db_feedback_events f
    where f.target_type = 'article'
      and f.page_title = 'Development Testing Page'
    union
    select n.meta->>'page_id'
    from public.db_admin_notifications n
    where n.meta->>'page_type' = 'article'
      and n.meta->>'page_title' = 'Development Testing Page'
      and nullif(n.meta->>'page_id', '') is not null
  ) candidate;

  if cardinality(v_target_ids) > 1 then
    raise exception 'Development Testing Page feedback matches multiple article IDs';
  end if;

  if cardinality(v_target_ids) = 1 then
    v_target_id := v_target_ids[1];

    delete from public.db_admin_notifications n
    where n.meta->>'page_type' = 'article'
      and n.meta->>'page_id' = v_target_id;

    delete from public.db_feedback_operations o
    where o.target_type = 'article'
      and o.target_id = v_target_id;

    delete from public.db_feedback_events f
    where f.target_type = 'article'
      and f.target_id = v_target_id;
  end if;
end;
$$;

alter table public.db_feedback_events
  drop constraint db_feedback_events_post_id_fkey,
  add constraint db_feedback_events_post_id_fkey
    foreign key (post_id) references public.db_posts(id) on delete cascade;

alter table public.db_admin_notifications
  drop constraint db_admin_notifications_post_id_fkey,
  add constraint db_admin_notifications_post_id_fkey
    foreign key (post_id) references public.db_posts(id) on delete cascade;

create function public.db_cleanup_post_feedback_operations()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.db_feedback_operations
  where target_type = 'article'
    and target_id = old.id::text;
  return old;
end;
$$;

create trigger trg_cleanup_post_feedback_operations
before delete on public.db_posts
for each row execute function public.db_cleanup_post_feedback_operations();

revoke all on function public.db_cleanup_post_feedback_operations() from public, anon, authenticated;
