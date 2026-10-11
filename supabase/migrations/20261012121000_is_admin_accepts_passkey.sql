create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = '' as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and (
      (auth.jwt() ->> 'aal') = 'aal2'
      or exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end
        ) as entry
        where entry ->> 'method' = 'passkey'
      )
      or not exists (
        select 1
        from auth.mfa_factors f
        where f.user_id = auth.uid()
          and f.status = 'verified'
      )
    ),
    false
  )
$$;

grant execute on function public.is_admin() to anon, authenticated, service_role;
