create or replace function public.db_clear_profile_data(p_author_id uuid)
returns jsonb language plpgsql security definer
set search_path = '' as $$
declare
  updated public.db_profiles;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required';
  end if;

  delete from public.db_experiences where author_id = p_author_id;
  delete from public.db_educations where author_id = p_author_id;
  delete from public.db_links where author_id = p_author_id;
  delete from public.db_items where category_id in (
    select id from public.db_categories where author_id = p_author_id
  );
  delete from public.db_categories where author_id = p_author_id;

  update public.db_profiles set
    name = '', username = '', headline = '', job_title = '', bio = '',
    email = '', city = '', postal_code = '', country = '', site_url = '',
    pronunciation = null
    where id = p_author_id
    returning * into updated;

  if not found then
    raise exception 'Profile not found';
  end if;

  return to_jsonb(updated);
end;
$$;

revoke all on function public.db_clear_profile_data(uuid)
  from public, anon, authenticated;
grant execute on function public.db_clear_profile_data(uuid)
  to authenticated, service_role;
