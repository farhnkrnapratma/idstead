-- Add site banner support to profiles
-- Similar to blog banners but stored in a separate versioned table

alter table public.db_profiles
  add column banner_version uuid;

create table public.db_profile_banner_versions (
  id uuid primary key,
  profile_id uuid not null unique,
  wide_object_key text not null unique,
  og_object_key text not null unique,
  wide_avif_object_key text unique,
  wide_webp_object_key text unique,
  og_webp_object_key text,
  wide_sha256 text not null check (wide_sha256 ~ '^[0-9a-f]{64}$'),
  og_sha256 text not null check (og_sha256 ~ '^[0-9a-f]{64}$'),
  wide_bytes integer not null check (wide_bytes > 0 and wide_bytes <= 512000),
  og_bytes integer not null check (og_bytes > 0 and og_bytes <= 512000),
  state text not null default 'pending' check (state in ('pending', 'staged', 'active', 'retired', 'cleaning', 'deleted')),
  retain boolean not null default false,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  cleanup_attempts integer not null default 0,
  cleanup_error text,
  check (wide_object_key = 'site/banner/' || profile_id::text || '/wide.avif'
    and (wide_avif_object_key is null or wide_avif_object_key = 'site/banner/' || profile_id::text || '/wide.avif')
    and (wide_webp_object_key is null or wide_webp_object_key = 'site/banner/' || profile_id::text || '/wide.webp')
    and og_object_key = 'site/banner/' || profile_id::text || '/og.webp'
    and (og_webp_object_key is null or og_webp_object_key = 'site/banner/' || profile_id::text || '/og.webp'))
);

create index db_profile_banner_cleanup_idx on public.db_profile_banner_versions(retired_at)
  where state in ('retired', 'cleaning') and not retain;
create index db_profile_banner_state_idx on public.db_profile_banner_versions(state, profile_id);

alter table public.db_profiles
  add constraint db_profiles_banner_version_fk
  foreign key (banner_version) references public.db_profile_banner_versions(id);

create index db_profiles_banner_version_idx on public.db_profiles(banner_version)
  where banner_version is not null;

alter table public.db_profile_banner_versions enable row level security;
revoke all on public.db_profile_banner_versions from public, anon, authenticated;
grant select on public.db_profile_banner_versions to anon, authenticated
  where state = 'active';
grant select, insert, update, delete on public.db_profile_banner_versions to service_role;

create policy site_banner_anon_read on public.db_profile_banner_versions to anon, authenticated
  for select using (state = 'active');
create policy site_banner_service on public.db_profile_banner_versions to service_role
  using (true) with check (true);
