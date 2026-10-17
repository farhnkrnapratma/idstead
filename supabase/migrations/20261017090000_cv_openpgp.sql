create table public.db_openpgp_keys (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check (fingerprint ~ '^([0-9A-F]{40}|[0-9A-F]{64})$'),
  armored text not null check (length(armored) <= 65536 and armored like '-----BEGIN PGP PUBLIC KEY BLOCK-----%'),
  user_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(user_ids) = 'array'),
  algorithm text not null default '',
  key_created_at timestamptz,
  expires_at timestamptz,
  keyservers jsonb not null default '[]'::jsonb check (jsonb_typeof(keyservers) = 'array' and jsonb_array_length(keyservers) <= 8),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index db_openpgp_keys_one_active on public.db_openpgp_keys (is_active) where is_active;

alter table public.db_openpgp_keys enable row level security;
revoke all on public.db_openpgp_keys from anon, authenticated;
grant select on public.db_openpgp_keys to anon, authenticated;
grant all on public.db_openpgp_keys to service_role;
create policy openpgp_keys_active_read on public.db_openpgp_keys for select to anon, authenticated
  using (is_active);

alter table public.db_documents
  add column checksums jsonb check (checksums is null or jsonb_typeof(checksums) = 'object'),
  add column signer_fingerprint text check (signer_fingerprint is null or signer_fingerprint ~ '^([0-9A-F]{40}|[0-9A-F]{64})$');
