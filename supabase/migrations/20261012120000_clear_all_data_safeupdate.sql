create or replace function public.db_clear_all_data()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  cleared_profile_id uuid;
begin
  delete from public.db_admin_notifications where true;
  delete from public.db_feedback_operations where true;
  delete from public.db_feedback_events where true;
  delete from public.db_comment_reports where true;
  delete from public.db_comments where true;
  delete from public.db_views where true;
  delete from public.db_post_feedback where true;
  delete from public.db_blog_banner_references where true;

  insert into public.db_post_storage_cleanup(storage_path, post_id)
    select storage_path, id from public.db_posts where storage_path is not null
    on conflict do nothing;

  delete from public.db_post_operations where true;
  delete from public.db_posts where true;
  delete from public.db_blog_banner_versions where true;

  delete from public.db_project_repo_rules where true;
  delete from public.db_legals where true;
  delete from public.db_activity_log where true;

  select id into cleared_profile_id from public.db_profiles limit 1;
  if cleared_profile_id is not null then
    perform public.db_clear_profile_data(cleared_profile_id);
  end if;

  return jsonb_build_object('success', true);
end;
$$;
