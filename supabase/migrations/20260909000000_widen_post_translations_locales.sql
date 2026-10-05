-- Allow Japanese ('ja'), Simplified Chinese ('zh') and Korean ('ko') alongside
-- Indonesian as blog post translation locales

alter table public.db_post_translations
  drop constraint if exists db_post_translations_locale_check;

alter table public.db_post_translations
  add constraint db_post_translations_locale_check
  check (locale in ('id', 'ja', 'zh', 'ko'));
