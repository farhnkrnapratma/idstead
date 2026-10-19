-- Store the server-computed reading time with each saved post.
CREATE OR REPLACE FUNCTION public.db_commit_post_operation(p_id uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  op public.db_post_operations;
  current_post public.db_posts;
  saved public.db_posts;
  version uuid;
  md_path text;
  reference_id uuid;
begin
  select * into op from public.db_post_operations where id = p_id and actor_id = p_actor;
  if not found then raise exception 'Unknown operation'; end if;
  perform pg_advisory_xact_lock(hashtextextended(op.post_id::text, 0));
  select * into op from public.db_post_operations where id = p_id for update;
  if op.state in ('committed', 'conflict', 'rejected') then return to_jsonb(op); end if;
  if op.state <> 'ready' then raise exception 'Upload not confirmed'; end if;
  select * into current_post from public.db_posts where id = op.post_id for update;
  if (op.expected_revision is null and current_post.id is not null)
    or (op.expected_revision is not null and (current_post.id is null or current_post.post_revision <> op.expected_revision)) then
    update public.db_post_operations set state = 'conflict' where id = p_id returning * into op;
    update public.db_blog_banner_versions set state = 'retired', retired_at = now() where id = p_id and state = 'pending';
    if op.kind = 'save' then
      insert into public.db_post_storage_cleanup(storage_path, post_id) values ('posts/' || op.post_id::text || '/' || p_id::text || '.md', op.post_id) on conflict do nothing;
    end if;
    return to_jsonb(op);
  end if;
  if op.kind = 'delete' then
    delete from public.db_posts where id = op.post_id;
    update public.db_blog_banner_versions set state = 'retired', retired_at = now() where id = current_post.banner_version and state = 'active';
    op.result := jsonb_build_object('id', op.post_id, 'deleted', true);
  else
    version := case op.banner_operation when 'keep' then current_post.banner_version when 'replace' then p_id else null end;
    if op.banner_operation = 'replace' then
      perform 1 from public.db_blog_banner_versions where id = version and post_id = op.post_id and state = 'pending' for update;
      if not found then raise exception 'Banner version unavailable'; end if;
    end if;
    md_path := 'posts/' || op.post_id::text || '/' || p_id::text || '.md';
    if current_post.id is null then
      insert into public.db_posts(id, title, slug, excerpt, tags, collaborators, published, storage_path, banner_version, summary, tldr, read_time, post_revision)
      values (op.post_id, op.post_data->>'title', op.post_data->>'slug', op.post_data->>'excerpt',
        array(select jsonb_array_elements_text(op.post_data->'tags')), array(select jsonb_array_elements_text(op.post_data->'collaborators')),
        (op.post_data->>'published')::boolean, md_path, version, op.post_data->>'summary',
        case when jsonb_typeof(op.post_data->'tldr') = 'array' then array(select jsonb_array_elements_text(op.post_data->'tldr')) else null end,
        case when jsonb_typeof(op.post_data->'read_time') = 'number' then (op.post_data->>'read_time')::integer else null end, 1)
      returning * into saved;
    else
      update public.db_posts set title = op.post_data->>'title', slug = op.post_data->>'slug', excerpt = op.post_data->>'excerpt',
        tags = array(select jsonb_array_elements_text(op.post_data->'tags')),
        collaborators = array(select jsonb_array_elements_text(op.post_data->'collaborators')),
        published = (op.post_data->>'published')::boolean, storage_path = md_path, banner_version = version,
        banner_path = case when op.banner_operation = 'keep' then banner_path else null end,
        summary = case when op.post_data ? 'summary' then op.post_data->>'summary' else summary end,
        tldr = case when op.post_data ? 'tldr' then case when jsonb_typeof(op.post_data->'tldr') = 'array' then array(select jsonb_array_elements_text(op.post_data->'tldr')) else null end else tldr end,
        read_time = case when jsonb_typeof(op.post_data->'read_time') = 'number' then (op.post_data->>'read_time')::integer else read_time end,
        updated_at = now()
        where id = op.post_id returning * into saved;
    end if;
    delete from public.db_blog_banner_references where post_id = op.post_id;
    for reference_id in select jsonb_array_elements_text(op.post_data->'banner_references')::uuid loop
      perform 1 from public.db_blog_banner_versions where id = reference_id and state in ('active', 'retired', 'staged') for update;
      if not found then raise exception 'Referenced banner is unavailable' using errcode = '23514'; end if;
      insert into public.db_blog_banner_references(post_id, version_id) values (op.post_id, reference_id);
    end loop;
    if version is distinct from current_post.banner_version then
      update public.db_blog_banner_versions set state = 'retired', retired_at = now() where id = current_post.banner_version and state = 'active';
      update public.db_blog_banner_versions set state = 'active' where id = version and state = 'pending';
    end if;
    op.result := jsonb_build_object('id', saved.id, 'post_revision', saved.post_revision, 'banner_version', saved.banner_version, 'slug', saved.slug, 'published', saved.published);
  end if;
  if current_post.storage_path is not null then
    insert into public.db_post_storage_cleanup(storage_path, post_id) values (current_post.storage_path, op.post_id) on conflict do nothing;
  end if;
  update public.db_post_operations set state = 'committed', result = op.result, committed_at = now() where id = p_id returning * into op;
  return to_jsonb(op);
exception when unique_violation or check_violation or not_null_violation or foreign_key_violation or invalid_text_representation then
  update public.db_post_operations set state = 'rejected' where id = p_id and actor_id = p_actor and state = 'ready' returning * into op;
  update public.db_blog_banner_versions set state = 'retired', retired_at = now() where id = p_id and state = 'pending';
  if op.kind = 'save' then
    insert into public.db_post_storage_cleanup(storage_path, post_id) values ('posts/' || op.post_id::text || '/' || p_id::text || '.md', op.post_id) on conflict do nothing;
  end if;
  return to_jsonb(op);
end;
$function$;
