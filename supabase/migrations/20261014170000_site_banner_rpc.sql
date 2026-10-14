-- RPC for preparing and committing site banner versions
-- Server-side only: validates key format and commits versioned metadata

create or replace function db_prepare_profile_banner_version(
  p_version_id uuid,
  p_profile_id uuid,
  p_wide_webp_object_key text,
  p_wide_webp_sha256 text,
  p_wide_webp_bytes integer,
  p_wide_avif_object_key text,
  p_wide_avif_sha256 text,
  p_wide_avif_bytes integer,
  p_og_webp_object_key text,
  p_og_webp_sha256 text,
  p_og_webp_bytes integer
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
  -- Validate version ID is UUID
  if not (p_version_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Invalid version ID';
  end if;

  -- Validate profile ID is UUID
  if not (p_profile_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Invalid profile ID';
  end if;

  -- Validate object key format: site/banner/{profile_id}/{filename}
  if p_wide_webp_object_key != ('site/banner/' || p_profile_id::text || '/wide.webp') then
    raise exception 'Invalid wide webp key';
  end if;
  if p_wide_avif_object_key != ('site/banner/' || p_profile_id::text || '/wide.avif') then
    raise exception 'Invalid wide avif key';
  end if;
  if p_og_webp_object_key != ('site/banner/' || p_profile_id::text || '/og.webp') then
    raise exception 'Invalid og webp key';
  end if;

  -- Validate SHA256 hashes are hex strings
  if p_wide_webp_sha256 !~ '^[0-9a-f]{64}$' or
     p_wide_avif_sha256 !~ '^[0-9a-f]{64}$' or
     p_og_webp_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid hash format';
  end if;

  -- Validate bytes are positive
  if p_wide_webp_bytes <= 0 or p_wide_avif_bytes <= 0 or p_og_webp_bytes <= 0 then
    raise exception 'Invalid byte count';
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
    p_profile_id,
    'site/banner/' || p_profile_id::text || '/wide.avif',
    p_wide_webp_object_key,
    p_wide_avif_object_key,
    'site/banner/' || p_profile_id::text || '/og.webp',
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
grant execute on function db_prepare_profile_banner_version to service_role;
