alter table public.db_posts
  add column post_revision bigint not null default 0,
  add column banner_version uuid;

create table public.db_blog_banner_versions (
  id uuid primary key,
  post_id uuid not null,
  object_key text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes integer not null check (bytes > 0 and bytes <= 512000),
  state text not null default 'pending' check (state in ('pending', 'staged', 'active', 'retired', 'cleaning', 'deleted')),
  retain boolean not null default false,
  source_path text,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  cleanup_attempts integer not null default 0,
  cleanup_error text,
  check (object_key = 'blog/banners/' || post_id::text || '/' || id::text || '.webp')
);

alter table public.db_posts add constraint db_posts_banner_version_fk
  foreign key (banner_version) references public.db_blog_banner_versions(id);

create index db_posts_banner_version_idx on public.db_posts(banner_version) where banner_version is not null;
create index db_blog_banner_cleanup_idx on public.db_blog_banner_versions(retired_at) where state in ('retired', 'cleaning') and not retain;
create index db_blog_banner_post_idx on public.db_blog_banner_versions(post_id);

create table public.db_blog_banner_references (
  post_id uuid not null references public.db_posts(id) on delete cascade,
  version_id uuid not null references public.db_blog_banner_versions(id),
  primary key (post_id, version_id)
);
create index db_blog_banner_references_version_idx on public.db_blog_banner_references(version_id);
alter table public.db_blog_banner_references enable row level security;
revoke all on public.db_blog_banner_references from public, anon, authenticated;
grant select, insert, update, delete on public.db_blog_banner_references to service_role;
create policy blog_banner_references_service on public.db_blog_banner_references to service_role using (true) with check (true);

create table public.db_post_operations (
  id uuid primary key,
  actor_id uuid not null,
  post_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  expected_revision bigint,
  kind text not null check (kind in ('save', 'delete')),
  post_data jsonb not null,
  banner_operation text not null check (banner_operation in ('keep', 'replace', 'remove')),
  state text not null default 'pending' check (state in ('pending', 'ready', 'committed', 'conflict', 'rejected')),
  result jsonb,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create index db_post_operations_post_idx on public.db_post_operations(post_id);

create table public.db_post_storage_cleanup (
  storage_path text primary key,
  post_id uuid not null,
  created_at timestamptz not null default now(),
  cleanup_attempts integer not null default 0,
  cleanup_error text
);

alter table public.db_blog_banner_versions enable row level security;
alter table public.db_post_operations enable row level security;
alter table public.db_post_storage_cleanup enable row level security;
revoke all on public.db_blog_banner_versions, public.db_post_operations, public.db_post_storage_cleanup from public, anon, authenticated;
grant select, insert, update, delete on public.db_blog_banner_versions, public.db_post_operations, public.db_post_storage_cleanup to service_role;
create policy blog_banner_service on public.db_blog_banner_versions to service_role using (true) with check (true);
create policy post_operations_service on public.db_post_operations to service_role using (true) with check (true);
create policy post_storage_cleanup_service on public.db_post_storage_cleanup to service_role using (true) with check (true);

create function public.db_increment_post_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.title, new.slug, new.excerpt, new.tags, new.collaborators, new.published, new.pinned, new.storage_path, new.banner_path, new.banner_version, new.summary, new.tldr)
    is distinct from row(old.title, old.slug, old.excerpt, old.tags, old.collaborators, old.published, old.pinned, old.storage_path, old.banner_path, old.banner_version, old.summary, old.tldr) then
    new.post_revision := old.post_revision + 1;
  else
    new.post_revision := old.post_revision;
  end if;
  return new;
end;
$$;
create trigger increment_post_revision before update on public.db_posts for each row execute function public.db_increment_post_revision();

create function public.db_prepare_post_operation(p_id uuid, p_actor uuid, p_post_id uuid, p_hash text, p_revision bigint, p_kind text, p_post jsonb, p_banner jsonb)
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
    insert into public.db_blog_banner_versions(id, post_id, object_key, sha256, bytes)
      values (p_id, p_post_id, 'blog/banners/' || p_post_id::text || '/' || p_id::text || '.webp', p_banner->>'sha256', (p_banner->>'bytes')::integer);
  end if;
  return to_jsonb(op);
end;
$$;

create function public.db_ready_post_operation(p_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.db_post_operations set state = 'ready' where id = p_id and actor_id = p_actor and state = 'pending';
end;
$$;

create function public.db_commit_post_operation(p_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
    insert into public.db_post_storage_cleanup(storage_path, post_id)
      select storage_path, op.post_id from public.db_post_translations where post_id = op.post_id and storage_path is not null
      on conflict do nothing;
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
      insert into public.db_posts(id, title, slug, excerpt, tags, collaborators, published, storage_path, banner_version, summary, tldr, post_revision)
      values (op.post_id, op.post_data->>'title', op.post_data->>'slug', op.post_data->>'excerpt',
        array(select jsonb_array_elements_text(op.post_data->'tags')), array(select jsonb_array_elements_text(op.post_data->'collaborators')),
        (op.post_data->>'published')::boolean, md_path, version, op.post_data->>'summary',
        case when jsonb_typeof(op.post_data->'tldr') = 'array' then array(select jsonb_array_elements_text(op.post_data->'tldr')) else null end, 1)
      returning * into saved;
    else
      update public.db_posts set title = op.post_data->>'title', slug = op.post_data->>'slug', excerpt = op.post_data->>'excerpt',
        tags = array(select jsonb_array_elements_text(op.post_data->'tags')),
        collaborators = array(select jsonb_array_elements_text(op.post_data->'collaborators')),
        published = (op.post_data->>'published')::boolean, storage_path = md_path, banner_version = version,
        banner_path = case when op.banner_operation = 'keep' then banner_path else null end,
        summary = case when op.post_data ? 'summary' then op.post_data->>'summary' else summary end,
        tldr = case when op.post_data ? 'tldr' then case when jsonb_typeof(op.post_data->'tldr') = 'array' then array(select jsonb_array_elements_text(op.post_data->'tldr')) else null end else tldr end,
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
$$;

create function public.db_claim_blog_banner_cleanup()
returns setof public.db_blog_banner_versions language sql security definer set search_path = '' as $$
  update public.db_blog_banner_versions v set state = 'cleaning', cleanup_attempts = cleanup_attempts + 1
  where v.id in (
    select candidate.id from public.db_blog_banner_versions candidate
    where candidate.state in ('retired', 'cleaning') and not candidate.retain
      and candidate.retired_at < now() - interval '24 hours'
      and not exists (select 1 from public.db_posts p where p.banner_version = candidate.id)
      and not exists (select 1 from public.db_blog_banner_references r where r.version_id = candidate.id)
      and not exists (select 1 from public.db_post_operations op where op.id = candidate.id and op.state in ('pending', 'ready'))
    order by candidate.retired_at limit 20 for update skip locked
  ) returning v.*;
$$;

revoke all on function public.db_increment_post_revision() from public, anon, authenticated;
revoke all on function public.db_prepare_post_operation(uuid, uuid, uuid, text, bigint, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.db_ready_post_operation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.db_commit_post_operation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.db_claim_blog_banner_cleanup() from public, anon, authenticated;
grant execute on function public.db_prepare_post_operation(uuid, uuid, uuid, text, bigint, text, jsonb, jsonb) to service_role;
grant execute on function public.db_ready_post_operation(uuid, uuid) to service_role;
grant execute on function public.db_commit_post_operation(uuid, uuid) to service_role;
grant execute on function public.db_claim_blog_banner_cleanup() to service_role;

create function public.db_activate_blog_banner_migration(p_posts jsonb, p_sources jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  snapshot jsonb;
  source jsonb;
  current_post public.db_posts;
  target public.db_blog_banner_versions;
begin
  lock table public.db_posts in share row exclusive mode;
  if (select count(*) from public.db_posts) <> jsonb_array_length(p_posts) then raise exception 'Post inventory changed'; end if;
  for source in select * from jsonb_array_elements(p_sources) loop
    select * into target from public.db_blog_banner_versions where id = (source->>'version')::uuid for update;
    if target.id is null or target.state not in ('staged', 'active')
      or target.sha256 <> source->'output'->>'sha256' or target.object_key <> source->'output'->>'key'
      or target.bytes <> (source->'output'->>'bytes')::integer then raise exception 'Banner has not been verified'; end if;
    update public.db_blog_banner_versions set state = 'active', retain = retain or not exists (select 1 from public.db_posts p where p.id = target.post_id) where id = target.id;
  end loop;
  for snapshot in select * from jsonb_array_elements(p_posts) loop
    select * into current_post from public.db_posts where id = (snapshot->>'id')::uuid for update;
    if current_post.id is null or current_post.banner_path is distinct from snapshot->>'banner_path'
      or current_post.storage_path is distinct from snapshot->>'storage_path'
      or current_post.updated_at is distinct from (snapshot->>'updated_at')::timestamptz
      or current_post.slug is distinct from snapshot->>'slug'
      or current_post.published is distinct from (snapshot->>'published')::boolean then raise exception 'Post inventory changed'; end if;
    if current_post.banner_path is not null then
      select value into source from jsonb_array_elements(p_sources) where value->>'path' = current_post.banner_path;
      if source is null then raise exception 'Banner missing from manifest'; end if;
      select * into target from public.db_blog_banner_versions where id = (source->>'version')::uuid for update;
      if target.id is null or target.post_id <> current_post.id or target.state not in ('staged', 'active')
        or target.sha256 <> source->'output'->>'sha256' or target.object_key <> source->'output'->>'key'
        or target.bytes <> (source->'output'->>'bytes')::integer then raise exception 'Banner has not been verified'; end if;
      update public.db_blog_banner_versions set state = 'active' where id = target.id;
      update public.db_posts set banner_version = target.id where id = current_post.id;
    end if;
  end loop;
end;
$$;
revoke all on function public.db_activate_blog_banner_migration(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.db_activate_blog_banner_migration(jsonb, jsonb) to service_role;

create function public.db_guard_post_banner_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated')
    and ((tg_op = 'INSERT' and new.banner_version is not null) or (tg_op = 'UPDATE' and new.banner_version is distinct from old.banner_version)) then
    raise exception 'Banner versions require the internal save endpoint';
  end if;
  return new;
end;
$$;
create trigger guard_post_banner_version before insert or update on public.db_posts for each row execute function public.db_guard_post_banner_version();
revoke all on function public.db_guard_post_banner_version() from public, anon, authenticated;

create function public.db_finalize_blog_banner_migration(p_sources jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare source jsonb;
begin
  lock table public.db_posts in share row exclusive mode;
  for source in select * from jsonb_array_elements(p_sources) loop
    if source->>'path' not like 'banners/%' or source->>'path' like '%..%' then raise exception 'Invalid source path'; end if;
    perform 1 from public.db_blog_banner_versions where id = (source->>'version')::uuid and sha256 = source->'output'->>'sha256' and state = 'active';
    if not found then raise exception 'Migrated version unavailable'; end if;
    if exists (select 1 from public.db_posts where banner_path = source->>'path' and banner_version is distinct from (source->>'version')::uuid) then raise exception 'Legacy banner is still active'; end if;
    update public.db_posts set banner_path = null where banner_path = source->>'path';
  end loop;
end;
$$;
revoke all on function public.db_finalize_blog_banner_migration(jsonb) from public, anon, authenticated;
grant execute on function public.db_finalize_blog_banner_migration(jsonb) to service_role;
