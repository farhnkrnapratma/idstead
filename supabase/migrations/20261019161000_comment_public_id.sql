alter table public.db_comments
  add column public_id text collate "C"
    not null
    default encode(extensions.digest(extensions.gen_random_bytes(32), 'sha256'), 'hex');

alter table public.db_comments
  add constraint db_comments_public_id_format check (public_id ~ '^[0-9a-f]{64}$'),
  add constraint db_comments_public_id_key unique (public_id);

create trigger db_comments_keep_public_id
  before update of public_id on public.db_comments
  for each row execute function public.db_keep_post_public_id();
