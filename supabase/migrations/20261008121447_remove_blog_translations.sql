do $$
declare
  definition text;
  previous_definition text;
begin
  insert into public.db_post_storage_cleanup(storage_path, post_id)
    select storage_path, post_id
    from public.db_post_translations
    where storage_path is not null
    on conflict do nothing;

  definition := pg_get_functiondef(
    'public.db_commit_post_operation(uuid, uuid)'::regprocedure
  );
  previous_definition := definition;
  definition := replace(
    definition,
    E'    insert into public.db_post_storage_cleanup(storage_path, post_id)\n      select storage_path, op.post_id from public.db_post_translations where post_id = op.post_id and storage_path is not null\n      on conflict do nothing;\n',
    ''
  );
  if definition = previous_definition
    or position('db_post_translations' in definition) > 0 then
    raise exception 'Could not remove the translation dependency from db_commit_post_operation.';
  end if;
  execute definition;
end;
$$;

create or replace function public.db_clear_all_data()
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

  delete from public.db_post_operations;
  delete from public.db_posts;
  delete from public.db_blog_banner_versions;

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

create or replace function public.db_require_excerpt_for_post_publish()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.published and (new.excerpt is null or btrim(new.excerpt) = '') then
      raise exception 'Excerpt is required to publish a post.' using errcode = '23514';
    end if;
  elsif new.published
    and (new.excerpt is null or btrim(new.excerpt) = '')
    and (
      old.published is distinct from new.published
      or old.excerpt is distinct from new.excerpt
    ) then
    raise exception 'Excerpt is required to publish a post.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger db_posts_require_excerpt_for_publish
  before insert or update of published, excerpt on public.db_posts
  for each row execute function public.db_require_excerpt_for_post_publish();

drop function if exists public.db_save_glossary_terms(uuid, text[]);
drop table if exists public.db_post_translations cascade;
drop table if exists public.db_glossary_terms cascade;