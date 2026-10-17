drop function if exists public.save_author_links(uuid, text, jsonb);
drop function if exists public.save_cv_entries(uuid, jsonb, jsonb);
drop function if exists public.save_legal_page(text, text, text);
drop function if exists public.save_skills(uuid, jsonb);

revoke execute on function public.db_increment_view(uuid, text) from public, anon, authenticated;
revoke execute on function public.record_post_feedback(uuid, text, text) from public, anon, authenticated;
