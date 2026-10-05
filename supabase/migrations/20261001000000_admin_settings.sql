create table public.db_admin_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 4096),
  updated_at timestamptz not null default now()
);

alter table public.db_admin_settings enable row level security;

revoke all on public.db_admin_settings from public, anon, authenticated;
grant select, insert, update, delete on public.db_admin_settings to service_role;
