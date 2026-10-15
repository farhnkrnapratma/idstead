create or replace function public.db_save_profile_identity(p_profile jsonb, p_identity jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  current_profile public.db_profiles;
  target_id uuid := nullif(p_profile->>'id', '')::uuid;
  identity_id uuid := nullif(p_identity->>'version', '')::uuid;
  previous_avatar uuid;
  previous_banner uuid;
begin
  perform pg_advisory_xact_lock(84729011);
  if target_id is null then
    if exists(select 1 from public.db_profiles) then raise exception 'Profile already exists' using errcode = '40001'; end if;
    if identity_id is null then raise exception 'Profile image and website banner are required'; end if;
    insert into public.db_profiles(name, username, headline, job_title, bio, avatar, email, city, postal_code, country, site_url, pronunciation)
      values(p_profile->>'name',p_profile->>'username',p_profile->>'headline',p_profile->>'job_title',p_profile->>'bio','',p_profile->>'email',p_profile->>'city',p_profile->>'postal_code',p_profile->>'country',p_profile->>'site_url',p_profile->>'pronunciation') returning * into current_profile;
    target_id := current_profile.id;
  else
    select * into current_profile from public.db_profiles where id = target_id for update;
    if not found or current_profile.profile_revision is distinct from (p_profile->>'revision')::bigint then
      raise exception 'Profile revision conflict' using errcode = '40001';
    end if;
  end if;
  p_profile := to_jsonb(current_profile) || p_profile || jsonb_build_object(
    'manifest_settings', current_profile.manifest_settings || coalesce(p_profile->'manifest_settings', '{}'::jsonb)
  );
  p_profile := jsonb_set(p_profile, '{manifest_settings,display}', '"standalone"'::jsonb);
  previous_avatar := current_profile.avatar_version;
  previous_banner := current_profile.banner_version;
  if identity_id is not null then
    if jsonb_typeof(p_identity->'assets') is distinct from 'array' then
      raise exception 'Incomplete identity package';
    end if;
    if (select array_agg(asset->>'name' order by asset->>'name') from jsonb_array_elements(p_identity->'assets') as asset)
      is distinct from public.db_identity_asset_names() then
      raise exception 'Incomplete identity package';
    end if;
    update public.db_identity_versions set assets = p_identity->'assets', profile_id = target_id, retired_at = null
      where id = identity_id and kind = 'identity' and profile_id is null and retired_at is not null and cleanup_started_at is null;
    if not found then raise exception 'Identity version unavailable'; end if;
  end if;
  update public.db_profiles set
    name = p_profile->>'name', username = p_profile->>'username', headline = p_profile->>'headline',
    job_title = p_profile->>'job_title', bio = p_profile->>'bio', email = p_profile->>'email',
    city = p_profile->>'city', postal_code = p_profile->>'postal_code', country = p_profile->>'country',
    site_url = p_profile->>'site_url', pronunciation = p_profile->>'pronunciation',
    manifest_settings = jsonb_build_object('theme_color',p_profile->'manifest_settings'->>'theme_color','background_color',p_profile->'manifest_settings'->>'background_color','display',p_profile->'manifest_settings'->>'display'),
    avatar_version = coalesce(identity_id, avatar_version),
    banner_version = coalesce(identity_id, banner_version),
    avatar = case when coalesce(identity_id, avatar_version) is not null then rtrim(p_profile->>'site_url','/') || '/avatar.png' else avatar end
    where id = target_id returning * into current_profile;
  if identity_id is not null then
    update public.db_identity_versions set retired_at = now()
      where id in (previous_avatar, previous_banner) and id <> identity_id;
  end if;
  return to_jsonb(current_profile);
end;
$$;
revoke all on function public.db_save_profile_identity(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.db_save_profile_identity(jsonb, jsonb) to service_role;

update public.db_profiles
  set avatar = rtrim(site_url, '/') || '/avatar.png'
  where avatar_version is not null;
