-- Allow Korean ('ko') as a blog post translation locale

alter table public.db_post_translations
  drop constraint if exists db_post_translations_locale_check;

alter table public.db_post_translations
  add constraint db_post_translations_locale_check
  check (locale in ('id', 'ja', 'zh', 'ko'));
