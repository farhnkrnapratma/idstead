create function public.db_clear_all_data()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  cleared_profile_id uuid;
begin
  delete from public.db_admin_notifications;
  delete from public.db_feedback_operations;
  delete from public.db_feedback_events;
  delete from public.db_comment_reports;
  delete from public.db_comments;
  delete from public.db_views;
  delete from public.db_post_feedback;
  delete from public.db_blog_banner_references;

  insert into public.db_post_storage_cleanup(storage_path, post_id)
    select storage_path, id from public.db_posts where storage_path is not null
    on conflict do nothing;
  insert into public.db_post_storage_cleanup(storage_path, post_id)
    select storage_path, post_id from public.db_post_translations where storage_path is not null
    on conflict do nothing;

  delete from public.db_post_translations;
  delete from public.db_post_operations;
  delete from public.db_posts;
  delete from public.db_blog_banner_versions;

  delete from public.db_glossary_terms;
  delete from public.db_project_repo_rules;
  delete from public.db_legals;
  delete from public.db_activity_log;

  select id into cleared_profile_id from public.db_profiles limit 1;
  if cleared_profile_id is not null then
    perform public.db_clear_profile_data(cleared_profile_id);
  end if;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.db_clear_all_data() from public, anon, authenticated;
grant execute on function public.db_clear_all_data() to service_role;
