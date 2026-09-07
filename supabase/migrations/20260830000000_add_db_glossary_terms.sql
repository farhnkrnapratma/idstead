-- Protected-terms glossary: terms auto-excluded from AI translation on every post

create table if not exists public.db_glossary_terms (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.db_profiles(id) on delete cascade,
  term text not null,
  sort_order integer not null default 0,
  unique (author_id, term)
);

alter table public.db_glossary_terms enable row level security;

create policy "Admins can view glossary terms"
  on public.db_glossary_terms for select to authenticated
  using (public.is_admin());

create or replace function public.db_save_glossary_terms(
  p_author_id uuid,
  p_terms text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  term text;
  idx integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required';
  end if;

  delete from public.db_glossary_terms where author_id = p_author_id;

  if p_terms is not null then
    foreach term in array p_terms loop
      insert into public.db_glossary_terms (author_id, term, sort_order)
      values (p_author_id, term, idx);
      idx := idx + 1;
    end loop;
  end if;
end;
$$;

revoke all on function public.db_save_glossary_terms(uuid, text[]) from public;
revoke execute on function public.db_save_glossary_terms(uuid, text[]) from anon;
grant execute on function public.db_save_glossary_terms(uuid, text[]) to authenticated;
