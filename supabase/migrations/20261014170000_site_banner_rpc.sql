-- RPC for preparing and committing site banner versions

create or replace function db_prepare_profile_banner_version(
  p_version_id uuid,
  p_wide_webp_object_key text,
  p_wide_webp_sha256 text,
  p_wide_webp_bytes integer,
  p_wide_avif_object_key text,
  p_wide_avif_sha256 text,
  p_wide_avif_bytes integer,
  p_og_webp_object_key text,
  p_og_webp_sha256 text,
  p_og_webp_bytes integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid;
begin
  select auth.uid() into v_profile_id;
  if v_profile_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.db_profile_banner_versions (
    id,
    profile_id,
    wide_object_key,
    wide_webp_object_key,
    wide_avif_object_key,
    og_object_key,
    og_webp_object_key,
    wide_sha256,
    og_sha256,
    wide_bytes,
    og_bytes,
    state
  ) values (
    p_version_id,
    v_profile_id,
    'site/banner/' || v_profile_id::text || '/wide.avif',
    p_wide_webp_object_key,
    p_wide_avif_object_key,
    'site/banner/' || v_profile_id::text || '/og.webp',
    p_og_webp_object_key,
    p_wide_avif_sha256,
    p_og_webp_sha256,
    p_wide_avif_bytes,
    p_og_webp_bytes,
    'staged'
  );

  return p_version_id;
end $$;

revoke all on function db_prepare_profile_banner_version from public, anon, authenticated;
grant execute on function db_prepare_profile_banner_version to authenticated;
