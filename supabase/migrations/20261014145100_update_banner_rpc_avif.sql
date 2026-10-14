-- Update db_prepare_post_operation RPC to handle AVIF banners
-- Drop and recreate the function with AVIF support

drop function if exists public.db_prepare_post_operation(uuid, uuid, uuid, text, bigint, text, jsonb, jsonb);

create function public.db_prepare_post_operation(
  p_id uuid,
  p_actor uuid,
  p_post_id uuid,
  p_hash text,
  p_revision bigint,
  p_kind text,
  p_post jsonb,
  p_banner jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  op public.db_post_operations;
  current_post public.db_posts;
begin
  if p_actor is null or p_kind not in ('save', 'delete') or p_banner->>'operation' not in ('keep', 'replace', 'remove') then
    raise exception 'Invalid post operation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_post_id::text, 0));
  select * into op from public.db_post_operations where id = p_id for update;
  if found then
    if op.actor_id <> p_actor or op.request_hash <> p_hash then raise exception 'Operation ID already used' using errcode = '22023'; end if;
    return to_jsonb(op);
  end if;
  select * into current_post from public.db_posts where id = p_post_id for update;
  insert into public.db_post_operations(id, actor_id, post_id, request_hash, expected_revision, kind, post_data, banner_operation)
    values (p_id, p_actor, p_post_id, p_hash, p_revision, p_kind, p_post, p_banner->>'operation') returning * into op;
  if (p_revision is null and (current_post.id is not null or p_kind = 'delete'))
    or (p_revision is not null and (current_post.id is null or current_post.post_revision <> p_revision)) then
    update public.db_post_operations set state = 'conflict' where id = p_id returning * into op;
    return to_jsonb(op);
  end if;
  if p_kind = 'save' and op.banner_operation = 'replace' then
    insert into public.db_blog_banner_versions(
      id,
      post_id,
      object_key,
      sha256,
      bytes,
      avif_object_key,
      avif_sha256,
      avif_bytes
    )
      values (
        p_id,
        p_post_id,
        'blog/banners/' || p_post_id::text || '/' || p_id::text || '.webp',
        p_banner->>'sha256',
        (p_banner->>'bytes')::integer,
        'blog/banners/' || p_post_id::text || '/' || p_id::text || '.avif',
        p_banner->>'avifSha256',
        (p_banner->>'avifBytes')::integer
      );
  end if;
  return to_jsonb(op);
end;
$$;

revoke all on function public.db_prepare_post_operation(uuid, uuid, uuid, text, bigint, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.db_prepare_post_operation(uuid, uuid, uuid, text, bigint, text, jsonb, jsonb) to service_role;
