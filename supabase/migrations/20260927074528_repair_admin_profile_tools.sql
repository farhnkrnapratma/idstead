drop function public.db_activity_log_list(text, timestamptz, timestamptz, integer, integer);
drop function public.db_activity_log_export(text, timestamptz, timestamptz);

grant select, insert on public.db_activity_log to service_role;

create index if not exists db_activity_log_time_id_idx on public.db_activity_log (created_at desc, id desc);
create index if not exists db_activity_log_category_time_id_idx on public.db_activity_log (category, created_at desc, id desc);

create function public.db_activity_log_list(
  p_category text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 10,
  p_offset integer default 0,
  p_query text default null,
  p_direction text default 'desc'
)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_direction is null or p_direction not in ('asc', 'desc') then
    raise exception 'Invalid sort direction';
  end if;
  if p_category is not null and p_category not in ('profile', 'cv', 'skills', 'links', 'blog', 'auth', 'security') then
    raise exception 'Invalid category';
  end if;
  if p_from > p_to or length(p_query) > 250 or p_limit is null or p_limit not between 1 and 5000 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid log query';
  end if;
  return (
    with matched as materialized (
      select l.* from public.db_activity_log l
      where (p_category is null or l.category = p_category)
        and (p_from is null or l.created_at >= p_from)
        and (p_to is null or l.created_at <= p_to)
        and (nullif(btrim(p_query), '') is null or strpos(lower(concat_ws(' ', l.actor, l.action, l.summary)), lower(btrim(p_query))) > 0)
    ), paged as (
      select * from matched
      order by
        case when p_direction = 'asc' then created_at end asc,
        case when p_direction = 'desc' then created_at end desc,
        case when p_direction = 'asc' then id end asc,
        case when p_direction = 'desc' then id end desc
      limit p_limit offset p_offset
    )
    select jsonb_build_object(
      'data', coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb),
      'total', (select count(*) from matched)
    )
  );
end;
$$;
revoke all on function public.db_activity_log_list(text,timestamptz,timestamptz,integer,integer,text,text) from public, anon, authenticated;
grant execute on function public.db_activity_log_list(text,timestamptz,timestamptz,integer,integer,text,text) to service_role;

create function public.db_activity_log_export(
  p_category text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_query text default null,
  p_direction text default 'desc'
)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.db_activity_log_list(p_category,p_from,p_to,5000,0,p_query,p_direction);
$$;
revoke all on function public.db_activity_log_export(text,timestamptz,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.db_activity_log_export(text,timestamptz,timestamptz,text,text) to service_role;

create or replace function public.db_clear_profile_data(p_author_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  updated public.db_profiles;
begin
  perform pg_advisory_xact_lock(84729011);
  select * into updated from public.db_profiles where id = p_author_id for update;
  if not found then raise exception 'Profile not found'; end if;

  delete from public.db_experiences where author_id = p_author_id;
  delete from public.db_educations where author_id = p_author_id;
  delete from public.db_links where author_id = p_author_id;
  delete from public.db_items where category_id in (select id from public.db_categories where author_id = p_author_id);
  delete from public.db_categories where author_id = p_author_id;
  update public.db_documents set is_active = false where author_id = p_author_id;
  update public.db_identity_versions set retired_at = coalesce(retired_at, now()) where profile_id = p_author_id;

  update public.db_profiles set
    name = '', username = '', headline = '', job_title = '', bio = '',
    email = '', city = '', postal_code = '', country = '', site_url = '',
    pronunciation = null, avatar = '', avatar_version = null
    where id = p_author_id returning * into updated;
  return to_jsonb(updated);
end;
$$;
revoke all on function public.db_clear_profile_data(uuid) from public, anon, authenticated;
grant execute on function public.db_clear_profile_data(uuid) to service_role;

create or replace function public.db_commit_profile_identity(p_profile jsonb, p_version uuid, p_assets jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  current_profile public.db_profiles;
  target_id uuid := nullif(p_profile->>'id', '')::uuid;
  previous_version uuid;
begin
  perform pg_advisory_xact_lock(84729011);
  if target_id is null then
    if exists(select 1 from public.db_profiles) then raise exception 'Profile already exists' using errcode = '40001'; end if;
    if p_version is null then raise exception 'Profile image is required'; end if;
    insert into public.db_profiles(name, username, headline, job_title, bio, avatar, email, city, postal_code, country, site_url, pronunciation)
      values(p_profile->>'name',p_profile->>'username',p_profile->>'headline',p_profile->>'job_title',p_profile->>'bio','',p_profile->>'email',p_profile->>'city',p_profile->>'postal_code',p_profile->>'country',p_profile->>'site_url',p_profile->>'pronunciation') returning * into current_profile;
    target_id := current_profile.id;
  else
    select * into current_profile from public.db_profiles where id = target_id for update;
    if not found or current_profile.profile_revision <> (p_profile->>'revision')::bigint then
      raise exception 'Profile revision conflict' using errcode = '40001';
    end if;
  end if;
  p_profile := to_jsonb(current_profile) || p_profile || jsonb_build_object(
    'manifest_settings', current_profile.manifest_settings || coalesce(p_profile->'manifest_settings', '{}'::jsonb)
  );
  p_profile := jsonb_set(p_profile, '{manifest_settings,display}', '"standalone"'::jsonb);
  previous_version := current_profile.avatar_version;
  if p_version is not null then
    if jsonb_array_length(p_assets) <> 8 then raise exception 'Incomplete image package'; end if;
    update public.db_identity_versions set assets = p_assets, profile_id = target_id, retired_at = null
      where id = p_version and profile_id is null and retired_at is not null and cleanup_started_at is null;
    if not found then raise exception 'Image version unavailable'; end if;
  end if;
  update public.db_profiles set
    name = p_profile->>'name', username = p_profile->>'username', headline = p_profile->>'headline',
    job_title = p_profile->>'job_title', bio = p_profile->>'bio', email = p_profile->>'email',
    city = p_profile->>'city', postal_code = p_profile->>'postal_code', country = p_profile->>'country',
    site_url = p_profile->>'site_url', pronunciation = btrim(regexp_replace(btrim(p_profile->>'pronunciation'), '^/+|/+$', '', 'g')),
    manifest_settings = jsonb_build_object('theme_color',p_profile->'manifest_settings'->>'theme_color','background_color',p_profile->'manifest_settings'->>'background_color','display',p_profile->'manifest_settings'->>'display'),
    avatar_version = coalesce(p_version, avatar_version),
    avatar = case when coalesce(p_version, avatar_version) is not null then rtrim(p_profile->>'site_url','/') || '/avatar.png?v=' || coalesce(p_version, avatar_version)::text else avatar end
    where id = target_id returning * into current_profile;
  if p_version is not null and previous_version is not null then
    update public.db_identity_versions set retired_at = now() where id = previous_version;
  end if;
  return to_jsonb(current_profile);
end;
$$;
revoke all on function public.db_commit_profile_identity(jsonb,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.db_commit_profile_identity(jsonb,uuid,jsonb) to service_role;

update public.db_profiles set manifest_settings = jsonb_set(manifest_settings, '{display}', '"standalone"'::jsonb) where manifest_settings->>'display' is distinct from 'standalone';
