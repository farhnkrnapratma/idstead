-- Homepage Projects section rules: exclude repos by name, pin up to 3 repos

create table if not exists public.db_project_repo_rules (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.db_profiles(id) on delete cascade,
  rule_type text not null check (rule_type in ('exclude', 'pin')),
  repo_name text not null,
  sort_order integer not null default 0,
  unique (author_id, rule_type, repo_name)
);

alter table public.db_project_repo_rules enable row level security;

create policy "Public read project repo rules"
  on public.db_project_repo_rules for select to public
  using (true);

create or replace function public.db_save_project_repo_rules(
  p_author_id uuid,
  p_rule_type text,
  p_names text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  repo_name text;
  idx integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin privileges required';
  end if;

  if p_rule_type not in ('exclude', 'pin') then
    raise exception 'Invalid rule type: %', p_rule_type;
  end if;

  if p_rule_type = 'pin' and p_names is not null and cardinality(p_names) > 3 then
    raise exception 'Maximum of 3 pinned repos allowed';
  end if;

  delete from public.db_project_repo_rules
    where author_id = p_author_id and rule_type = p_rule_type;

  if p_names is not null then
    foreach repo_name in array p_names loop
      insert into public.db_project_repo_rules (author_id, rule_type, repo_name, sort_order)
      values (p_author_id, p_rule_type, repo_name, idx);
      idx := idx + 1;
    end loop;
  end if;
end;
$$;

revoke all on function public.db_save_project_repo_rules(uuid, text, text[]) from public;
revoke execute on function public.db_save_project_repo_rules(uuid, text, text[]) from anon;
grant execute on function public.db_save_project_repo_rules(uuid, text, text[]) to authenticated;
