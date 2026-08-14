-- Migration: atomic_save_rpcs
-- Created: 2026-08-05
-- Purpose: Replace raw delete+insert patterns with atomic Postgres RPC
--          functions that run inside a single transaction with SECURITY DEFINER
--          to safely handle atomic updates without table-level RLS restrictions.

-- ============================================================
-- RPC: save_author_links
-- Atomic replace-all for social / funding / contact categories
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_author_links(
  p_author_id uuid,
  p_category   text,
  p_items      jsonb   -- array of {platform, display_value, url, icon, sort_order}
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

REVOKE ALL ON FUNCTION public.save_author_links(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_author_links(uuid, text, jsonb) TO authenticated;

-- ============================================================
-- RPC: save_skills
-- Atomic replace-all for skill_categories + skill_items
-- (skill_items cascade-deletes when skill_categories is deleted)
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_skills(
  p_author_id  uuid,
  p_categories jsonb  -- array of {category, sort_order, skills: string[]}
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

REVOKE ALL ON FUNCTION public.save_skills(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_skills(uuid, jsonb) TO authenticated;

-- ============================================================
-- RPC: save_cv_entries
-- Atomic replace-all for experiences + education
-- ============================================================
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

REVOKE ALL ON FUNCTION public.save_cv_entries(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_cv_entries(uuid, jsonb, jsonb) TO authenticated;
