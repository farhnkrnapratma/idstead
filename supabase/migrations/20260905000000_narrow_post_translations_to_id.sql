delete from public.db_post_translations
where locale <> 'id';

alter table public.db_post_translations
  drop constraint if exists db_post_translations_locale_check;

alter table public.db_post_translations
  add constraint db_post_translations_locale_check
  check (locale in ('id'));
