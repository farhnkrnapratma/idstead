-- Migration: close_rls_and_rpc_privilege_gaps
-- Created: 2026-08-07
-- Purpose: Close two live authorization gaps found while verifying
--          SECURITY-AUDIT-202608070241.md against the running database.
--
-- Gap 1: Every content table below still carried a leftover
--   "Authenticated <table> all" policy (USING (true) / WITH CHECK (true))
--   from before the *_admin_all / is_admin() policies existed. RLS ORs
--   permissive policies together, so the leftover policy fully defeated
--   the admin-only policy sitting right next to it - any authenticated
--   (not just admin) Supabase user could INSERT/UPDATE/DELETE these
--   tables directly via PostgREST, bypassing the admin UI entirely.
--
-- Gap 2: save_author_links/save_cv_entries/save_skills are SECURITY
--   DEFINER RPCs. Their migration ran `REVOKE ALL ... FROM PUBLIC` then
--   `GRANT EXECUTE ... TO authenticated` - but Supabase's project-wide
--   default privileges grant EXECUTE on every new public-schema function
--   directly to anon/authenticated by role name at creation time.
--   Revoking from the PUBLIC pseudo-role never touches a grant made
--   directly to a named role, so anon kept EXECUTE the whole time
--   (confirmed via has_function_privilege). The functions also only
--   checked `auth.uid() IS NULL` (any signed-in session), not admin
--   role, unlike the equivalent Edge Function's requireAdmin().

-- ============================================================
-- Fix 1: drop the leftover blanket "authenticated can do anything"
-- policies. The paired `<table>_admin_all` / is_admin() policies already
-- provide the correct admin-only access; public read policies are
-- untouched.
-- ============================================================
DROP POLICY IF EXISTS "Authenticated author_links all" ON public.author_links;
DROP POLICY IF EXISTS "Authenticated author_profile all" ON public.author_profile;
DROP POLICY IF EXISTS "Authenticated cv_documents all" ON public.cv_documents;
DROP POLICY IF EXISTS "Authenticated education all" ON public.education;
DROP POLICY IF EXISTS "Authenticated experiences all" ON public.experiences;
DROP POLICY IF EXISTS "Authenticated skill_categories all" ON public.skill_categories;
DROP POLICY IF EXISTS "Authenticated skill_items all" ON public.skill_items;

-- ============================================================
-- Fix 2a: explicitly revoke EXECUTE from anon by name (REVOKE ... FROM
-- PUBLIC does not touch this - anon holds it as a direct grant from
-- Supabase's default privileges, not via the PUBLIC pseudo-role).
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.save_author_links(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_cv_entries(uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_skills(uuid, jsonb) FROM anon;

-- ============================================================
-- Fix 2b: replace the "any authenticated session" check with the same
-- is_admin() check used everywhere else, so a non-admin authenticated
-- user (e.g. a future signed-up account) can't call these either.
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_author_links(
  p_author_id uuid,
  p_category   text,
  p_items      jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  IF p_category NOT IN ('social', 'funding', 'contact') THEN
    RAISE EXCEPTION 'Invalid category: %', p_category;
  END IF;

  DELETE FROM public.author_links
  WHERE author_id = p_author_id
    AND category  = p_category;

  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.author_links
      (author_id, category, platform, display_value, url, icon, sort_order)
    SELECT
      p_author_id,
      p_category,
      (item->>'platform'),
      (item->>'display_value'),
      (item->>'url'),
      COALESCE(item->>'icon', 'bi-link'),
      (item->>'sort_order')::int
    FROM jsonb_array_elements(p_items) AS item;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_skills(
  p_author_id  uuid,
  p_categories jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat        jsonb;
  v_cat_id     uuid;
  v_skill_name text;
  v_skill_idx  int;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  DELETE FROM public.skill_categories
  WHERE author_id = p_author_id;

  IF jsonb_array_length(p_categories) > 0 THEN
    FOR v_cat IN SELECT * FROM jsonb_array_elements(p_categories)
    LOOP
      INSERT INTO public.skill_categories (author_id, category, sort_order)
      VALUES (
        p_author_id,
        (v_cat->>'category'),
        (v_cat->>'sort_order')::int
      )
      RETURNING id INTO v_cat_id;

      v_skill_idx := 1;
      FOR v_skill_name IN
        SELECT jsonb_array_elements_text(v_cat->'skills')
      LOOP
        INSERT INTO public.skill_items (category_id, name, sort_order)
        VALUES (v_cat_id, v_skill_name, v_skill_idx);
        v_skill_idx := v_skill_idx + 1;
      END LOOP;
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_cv_entries(
  p_author_id    uuid,
  p_experiences  jsonb,
  p_education    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  DELETE FROM public.experiences WHERE author_id = p_author_id;
  DELETE FROM public.education   WHERE author_id = p_author_id;

  IF jsonb_array_length(p_experiences) > 0 THEN
    INSERT INTO public.experiences
      (author_id, title, type, company, start_month, start_year,
       end_month, end_year, currently_in, location, loc_type, description, sort_order)
    SELECT
      p_author_id,
      (e->>'title'),
      (e->>'type'),
      (e->>'company'),
      (e->>'start_month'),
      (e->>'start_year')::int,
      NULLIF(e->>'end_month', ''),
      CASE WHEN e->>'end_year' IS NULL OR e->>'end_year' = 'null' THEN NULL
           ELSE (e->>'end_year')::int END,
      (e->>'currently_in')::boolean,
      (e->>'location'),
      (e->>'loc_type'),
      (e->>'description'),
      (e->>'sort_order')::int
    FROM jsonb_array_elements(p_experiences) AS e;
  END IF;

  IF jsonb_array_length(p_education) > 0 THEN
    INSERT INTO public.education
      (author_id, institution, degree, field, start_month, start_year,
       end_month, end_year, currently_in, grade, description, sort_order)
    SELECT
      p_author_id,
      (ed->>'institution'),
      (ed->>'degree'),
      (ed->>'field'),
      (ed->>'start_month'),
      (ed->>'start_year')::int,
      NULLIF(ed->>'end_month', ''),
      CASE WHEN ed->>'end_year' IS NULL OR ed->>'end_year' = 'null' THEN NULL
           ELSE (ed->>'end_year')::int END,
      (ed->>'currently_in')::boolean,
      (ed->>'grade'),
      (ed->>'description'),
      (ed->>'sort_order')::int
    FROM jsonb_array_elements(p_education) AS ed;
  END IF;
END;
$$;

-- ============================================================
-- Fix 3: stop this from recurring for every future function. Supabase's
-- out-of-the-box default privileges grant EXECUTE on new public-schema
-- functions to anon/authenticated directly - override that default so
-- new functions start with no EXECUTE grant at all, and require an
-- explicit `GRANT EXECUTE ... TO <role>` (matching how table privileges
-- already have to be granted explicitly via RLS policies).
-- ============================================================
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
