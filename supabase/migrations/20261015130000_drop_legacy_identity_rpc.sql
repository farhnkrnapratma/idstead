drop function public.db_commit_profile_identity(jsonb, uuid, jsonb);
drop function public.db_save_profile_identity(jsonb, jsonb, jsonb);

alter table public.db_identity_versions
  drop constraint db_identity_versions_kind_check,
  add constraint db_identity_versions_kind_check check (kind = 'identity'),
  alter column kind set default 'identity';
