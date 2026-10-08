create table public.db_ard_index (
  site_url text primary key check (length(site_url) <= 2048),
  entries jsonb not null check (
    jsonb_typeof(entries) = 'array'
    and jsonb_array_length(entries) <= 1000
    and pg_column_size(entries) <= 4194304
  ),
  sources text[] not null default '{}'
    check (cardinality(sources) <= 32),
  indexed_at timestamptz not null
);

alter table public.db_ard_index enable row level security;

revoke all on public.db_ard_index from public, anon, authenticated;
grant select, insert, update on public.db_ard_index to service_role;