alter table public.db_identity_versions
  add column kind text not null default 'avatar' check (kind in ('avatar', 'banner')),
  add column source text not null default 'custom' check (source in ('custom', 'generated')),
  add column fingerprint text check (fingerprint is null or fingerprint ~ '^[0-9a-f]{64}$'),
  add constraint db_identity_versions_fingerprint_source_check
    check ((source = 'generated') = (fingerprint is not null));

alter table public.db_profiles
  add column banner_version uuid,
  add constraint db_profiles_banner_version_fk
    foreign key (banner_version) references public.db_identity_versions(id);

create index db_profiles_banner_version_idx on public.db_profiles(banner_version);

create or replace function public.db_profile_identity_kind() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.avatar_version is distinct from old.avatar_version and new.avatar_version is not null
    and not exists (select 1 from public.db_identity_versions v where v.id = new.avatar_version and v.kind = 'avatar') then
    raise exception 'Avatar version must reference an avatar package';
  end if;
  if new.banner_version is distinct from old.banner_version and new.banner_version is not null
    and not exists (select 1 from public.db_identity_versions v where v.id = new.banner_version and v.kind = 'banner') then
    raise exception 'Banner version must reference a banner package';
  end if;
  return new;
end;
$$;
revoke all on function public.db_profile_identity_kind() from public, anon, authenticated;
create trigger db_profile_identity_kind before update of avatar_version, banner_version on public.db_profiles
  for each row execute function public.db_profile_identity_kind();

drop policy identity_active_read on public.db_identity_versions;
create policy identity_active_read on public.db_identity_versions for select to anon, authenticated
  using (exists (
    select 1 from public.db_profiles p
    where p.avatar_version = db_identity_versions.id or p.banner_version = db_identity_versions.id
  ));

create or replace function public.db_save_profile_identity(p_profile jsonb, p_avatar jsonb, p_banner jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  current_profile public.db_profiles;
  target_id uuid := nullif(p_profile->>'id', '')::uuid;
  avatar_id uuid := nullif(p_avatar->>'version', '')::uuid;
  banner_id uuid := nullif(p_banner->>'version', '')::uuid;
  previous_avatar uuid;
  previous_banner uuid;
begin
  perform pg_advisory_xact_lock(84729011);
  if target_id is null then
    if exists(select 1 from public.db_profiles) then raise exception 'Profile already exists' using errcode = '40001'; end if;
    if avatar_id is null then raise exception 'Profile image is required'; end if;
    if banner_id is null then raise exception 'Website banner is required'; end if;
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
  if avatar_id is not null then
    if jsonb_typeof(p_avatar->'assets') <> 'array' or jsonb_array_length(p_avatar->'assets') not between 8 and 10 then
      raise exception 'Incomplete image package';
    end if;
    update public.db_identity_versions set assets = p_avatar->'assets', profile_id = target_id, retired_at = null
      where id = avatar_id and kind = 'avatar' and profile_id is null and retired_at is not null and cleanup_started_at is null;
    if not found then raise exception 'Image version unavailable'; end if;
  end if;
  if banner_id is not null then
    if jsonb_typeof(p_banner->'assets') <> 'array' or jsonb_array_length(p_banner->'assets') <> 3 then
      raise exception 'Incomplete banner package';
    end if;
    update public.db_identity_versions set assets = p_banner->'assets', profile_id = target_id, retired_at = null
      where id = banner_id and kind = 'banner' and profile_id is null and retired_at is not null and cleanup_started_at is null;
    if not found then raise exception 'Banner version unavailable'; end if;
  end if;
  update public.db_profiles set
    name = p_profile->>'name', username = p_profile->>'username', headline = p_profile->>'headline',
    job_title = p_profile->>'job_title', bio = p_profile->>'bio', email = p_profile->>'email',
    city = p_profile->>'city', postal_code = p_profile->>'postal_code', country = p_profile->>'country',
    site_url = p_profile->>'site_url', pronunciation = p_profile->>'pronunciation',
    manifest_settings = jsonb_build_object('theme_color',p_profile->'manifest_settings'->>'theme_color','background_color',p_profile->'manifest_settings'->>'background_color','display',p_profile->'manifest_settings'->>'display'),
    avatar_version = coalesce(avatar_id, avatar_version),
    banner_version = coalesce(banner_id, banner_version),
    avatar = case when coalesce(avatar_id, avatar_version) is not null then rtrim(p_profile->>'site_url','/') || '/avatar.png?v=' || coalesce(avatar_id, avatar_version)::text else avatar end
    where id = target_id returning * into current_profile;
  if avatar_id is not null and previous_avatar is not null then
    update public.db_identity_versions set retired_at = now() where id = previous_avatar;
  end if;
  if banner_id is not null and previous_banner is not null then
    update public.db_identity_versions set retired_at = now() where id = previous_banner;
  end if;
  return to_jsonb(current_profile);
end;
$$;
revoke all on function public.db_save_profile_identity(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.db_save_profile_identity(jsonb, jsonb, jsonb) to service_role;

create or replace function public.db_commit_profile_identity(p_profile jsonb, p_version uuid, p_assets jsonb)
returns jsonb language sql set search_path = '' as $$
  select public.db_save_profile_identity(
    p_profile,
    case when p_version is null then null else jsonb_build_object('version', p_version, 'assets', p_assets) end,
    null
  );
$$;
revoke all on function public.db_commit_profile_identity(jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.db_commit_profile_identity(jsonb, uuid, jsonb) to service_role;

create or replace function public.db_claim_identity_cleanup()
returns table(id uuid) language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(84729011);
  return query
    update public.db_identity_versions v set cleanup_started_at = now()
    where v.id in (
      select candidate.id from public.db_identity_versions candidate
      where candidate.retired_at is not null
        and jsonb_array_length(candidate.assets) > 0
        and not exists (
          select 1 from public.db_profiles p
          where p.avatar_version = candidate.id or p.banner_version = candidate.id
        )
      order by candidate.retired_at
      limit 10
      for update skip locked
    )
    returning v.id;
end;
$$;

create or replace function public.db_clear_profile_data(p_author_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
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
    pronunciation = null, avatar = '', avatar_version = null, banner_version = null
    where id = p_author_id returning * into updated;
  return to_jsonb(updated);
end;
$$;
