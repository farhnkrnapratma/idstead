-- Update RPC functions to strictly enforce public.is_admin() checking app_metadata ->> 'role' = 'admin'

CREATE OR REPLACE FUNCTION public.db_save_links(
  p_author_id uuid,
  p_contact_email text,
  p_socials jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  social_item jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  UPDATE public.db_profiles
  SET contact_email = p_contact_email, updated_at = now()
  WHERE id = p_author_id;

  DELETE FROM public.db_links WHERE author_id = p_author_id;

  IF p_socials IS NOT NULL AND jsonb_array_length(p_socials) > 0 THEN
    FOR social_item IN SELECT * FROM jsonb_array_elements(p_socials)
    LOOP
      INSERT INTO public.db_links (
        author_id, platform, label, url, icon, is_contact, sort_order
      ) VALUES (
        p_author_id,
        social_item->>'platform',
        social_item->>'label',
        social_item->>'url',
        NULLIF(social_item->>'icon', ''),
        COALESCE((social_item->>'is_contact')::boolean, false),
        COALESCE((social_item->>'sort_order')::integer, 0)
      );
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.db_save_links(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.db_save_links(uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.db_save_links(uuid, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.db_save_skills(
  p_author_id uuid,
  p_categories jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_item jsonb;
  skill_name text;
  cat_id uuid;
  cat_idx integer := 0;
  skill_idx integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  DELETE FROM public.db_categories WHERE author_id = p_author_id;

  IF p_categories IS NOT NULL AND jsonb_array_length(p_categories) > 0 THEN
    FOR cat_item IN SELECT * FROM jsonb_array_elements(p_categories)
    LOOP
      INSERT INTO public.db_categories (author_id, category, sort_order)
      VALUES (p_author_id, cat_item->>'category', cat_idx)
      RETURNING id INTO cat_id;

      cat_idx := cat_idx + 1;
      skill_idx := 0;

      IF cat_item->'skills' IS NOT NULL AND jsonb_array_length(cat_item->'skills') > 0 THEN
        FOR skill_name IN SELECT jsonb_array_elements_text(cat_item->'skills')
        LOOP
          INSERT INTO public.db_items (category_id, name, sort_order)
          VALUES (cat_id, skill_name, skill_idx);
          skill_idx := skill_idx + 1;
        END LOOP;
      END IF;
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.db_save_skills(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.db_save_skills(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.db_save_skills(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.db_save_cv(
  p_author_id uuid,
  p_experiences jsonb,
  p_education jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exp_item jsonb;
  edu_item jsonb;
  exp_idx integer := 0;
  edu_idx integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  DELETE FROM public.db_experiences WHERE author_id = p_author_id;
  DELETE FROM public.db_educations   WHERE author_id = p_author_id;

  IF p_experiences IS NOT NULL AND jsonb_array_length(p_experiences) > 0 THEN
    FOR exp_item IN SELECT * FROM jsonb_array_elements(p_experiences)
    LOOP
      INSERT INTO public.db_experiences (
        author_id, role, company, period, description, sort_order
      ) VALUES (
        p_author_id,
        exp_item->>'role',
        exp_item->>'company',
        exp_item->>'period',
        exp_item->>'description',
        exp_idx
      );
      exp_idx := exp_idx + 1;
    END LOOP;
  END IF;

  IF p_education IS NOT NULL AND jsonb_array_length(p_education) > 0 THEN
    FOR edu_item IN SELECT * FROM jsonb_array_elements(p_education)
    LOOP
      INSERT INTO public.db_educations (
        author_id, degree, institution, period, description, sort_order
      ) VALUES (
        p_author_id,
        edu_item->>'degree',
        edu_item->>'institution',
        edu_item->>'period',
        edu_item->>'description',
        edu_idx
      );
      edu_idx := edu_idx + 1;
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.db_save_cv(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.db_save_cv(uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.db_save_cv(uuid, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.db_save_legal(
  p_slug text,
  p_title text,
  p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  INSERT INTO public.db_legals (slug, title, content, updated_at)
  VALUES (p_slug, p_title, p_content, now())
  ON CONFLICT (slug)
  DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.db_save_legal(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.db_save_legal(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.db_save_legal(text, text, text) TO authenticated;

-- Helper function to safely grant admin role in raw_app_meta_data by email
CREATE OR REPLACE FUNCTION public.grant_admin_role_by_email(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  WHERE LOWER(email) = LOWER(target_email);
END;
$$;
