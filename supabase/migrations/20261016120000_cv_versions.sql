alter table public.db_documents
  add column version text check (version is null or version ~ '^[0-9]+\.[0-9]+$'),
  add column signed_at timestamptz;

create table public.db_document_snapshots (
  document_id uuid primary key references public.db_documents(id) on delete cascade,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.db_document_snapshots enable row level security;
revoke all on public.db_document_snapshots from anon, authenticated;
grant all on public.db_document_snapshots to service_role;
