-- Add collaborators and helpful feedback tracking to db_posts

alter table if exists public.db_posts
  add column if not exists collaborators text[] default '{}',
  add column if not exists helpful_yes integer default 0,
  add column if not exists helpful_no integer default 0;

-- Table to store unique feedback per post per client/IP
create table if not exists public.db_post_feedback (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.db_posts(id) on delete cascade not null,
  vote text check (vote in ('yes', 'no')) not null,
  ip_hash text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint db_post_feedback_unique unique (post_id, ip_hash)
);

alter table if exists public.db_post_feedback enable row level security;

-- Function for atomic feedback recording and counter increment
create or replace function public.record_post_feedback(
  p_post_id uuid,
  p_vote text,
  p_ip_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean := false;
begin
  insert into public.db_post_feedback (post_id, vote, ip_hash)
  values (p_post_id, p_vote, p_ip_hash)
  on conflict (post_id, ip_hash) do nothing;

  if found then
    if p_vote = 'yes' then
      update public.db_posts set helpful_yes = coalesce(helpful_yes, 0) + 1 where id = p_post_id;
    elsif p_vote = 'no' then
      update public.db_posts set helpful_no = coalesce(helpful_no, 0) + 1 where id = p_post_id;
    end if;
    return true;
  end if;

  return false;
end;
$$;
