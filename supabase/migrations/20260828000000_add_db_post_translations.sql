-- Add AI-generated blog post translations (Indonesian, Japanese, Simplified Chinese)

create table if not exists public.db_post_translations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.db_posts(id) on delete cascade not null,
  locale text not null check (locale in ('id', 'ja', 'zh')),
  title text not null,
  excerpt text,
  summary text,
  tldr text[],
  storage_path text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint db_post_translations_unique unique (post_id, locale)
);

alter table public.db_post_translations
  add constraint db_post_translations_tldr_valid check (public.validate_post_tldr(tldr));

alter table public.db_post_translations enable row level security;

create policy "Public read translations of published posts"
  on public.db_post_translations for select to public
  using (
    exists (
      select 1 from public.db_posts p
      where p.id = db_post_translations.post_id and p.published = true
    )
  );
