create or replace function public.db_record_page_feedback(
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
    if (v_operation.target_type, v_operation.target_id, v_operation.vote)
      is distinct from (p_target_type, p_target_id, p_vote) then
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

revoke all on function public.db_record_page_feedback(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.db_record_page_feedback(uuid, text, text, text, text) to service_role;
