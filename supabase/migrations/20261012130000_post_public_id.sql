alter table public.db_posts
  add column public_id text collate "C"
    not null
    default encode(extensions.digest(extensions.gen_random_bytes(32), 'sha256'), 'hex');

alter table public.db_posts
  add constraint db_posts_public_id_format check (public_id ~ '^[0-9a-f]{64}$'),
  add constraint db_posts_public_id_key unique (public_id);

create or replace function public.db_keep_post_public_id()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.public_id is distinct from old.public_id then
    raise exception 'public_id is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger db_posts_keep_public_id
  before update of public_id on public.db_posts
  for each row execute function public.db_keep_post_public_id();
