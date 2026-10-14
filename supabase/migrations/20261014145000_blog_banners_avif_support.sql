-- Add AVIF support to blog banners
-- Allows storing both WebP and AVIF versions of each banner

alter table public.db_blog_banner_versions
  add column avif_object_key text unique,
  add column avif_bytes integer check (avif_bytes is null or (avif_bytes > 0 and avif_bytes <= 512000)),
  add column avif_sha256 text check (avif_sha256 is null or avif_sha256 ~ '^[0-9a-f]{64}$');

-- Drop old constraint that hardcoded .webp extension
alter table public.db_blog_banner_versions
  drop constraint db_blog_banner_versions_object_key_check;

-- Add new constraint that allows both .webp and .avif
alter table public.db_blog_banner_versions
  add constraint db_blog_banner_versions_keys_check
  check (
    object_key = 'blog/banners/' || post_id::text || '/' || id::text || '.webp'
    and (avif_object_key is null or avif_object_key = 'blog/banners/' || post_id::text || '/' || id::text || '.avif')
  );

-- Ensure that if avif is present, both sha256 and bytes are present
alter table public.db_blog_banner_versions
  add constraint avif_fields_together
  check (
    (avif_object_key is null and avif_bytes is null and avif_sha256 is null)
    or (avif_object_key is not null and avif_bytes is not null and avif_sha256 is not null)
  );

-- Create index for AVIF cleanup queries
create index db_blog_banner_avif_cleanup_idx on public.db_blog_banner_versions(avif_object_key)
  where avif_object_key is not null;
