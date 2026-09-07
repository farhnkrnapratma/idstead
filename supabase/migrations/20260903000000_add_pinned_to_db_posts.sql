alter table public.db_posts add column if not exists pinned boolean not null default false;

create or replace function public.enforce_max_pinned_posts()
returns trigger
language plpgsql
as $$
begin
  if new.pinned and (tg_op = 'INSERT' or not old.pinned) then
    if (select count(*) from public.db_posts where pinned) >= 3 then
      raise exception 'Maximum of 3 pinned posts allowed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_max_pinned_posts on public.db_posts;

create trigger trg_enforce_max_pinned_posts
before insert or update of pinned on public.db_posts
for each row execute function public.enforce_max_pinned_posts();
