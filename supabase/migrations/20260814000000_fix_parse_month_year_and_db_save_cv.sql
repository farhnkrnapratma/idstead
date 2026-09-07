





CREATE OR REPLACE FUNCTION public.parse_month_year_to_date(m text, y integer)
RETURNS date
LANGUAGE plpgsql
AS $$
DECLARE
    month_num int;
BEGIN
    IF y IS NULL THEN
        RETURN NULL;
    END IF;
    IF m IS NULL OR btrim(m) = '' THEN
        RETURN pg_catalog.make_date(y, 1, 1);
    END IF;

    CASE pg_catalog.lower(btrim(m))
        WHEN 'jan', 'january', '01', '1' THEN month_num := 1;
        WHEN 'feb', 'february', '02', '2' THEN month_num := 2;
        WHEN 'mar', 'march', '03', '3' THEN month_num := 3;
        WHEN 'apr', 'april', '04', '4' THEN month_num := 4;
        WHEN 'may', '05', '5' THEN month_num := 5;
        WHEN 'jun', 'june', '06', '6' THEN month_num := 6;
        WHEN 'jul', 'july', '07', '7' THEN month_num := 7;
        WHEN 'aug', 'august', '08', '8' THEN month_num := 8;
        WHEN 'sep', 'september', '09', '9' THEN month_num := 9;
        WHEN 'oct', 'october', '10' THEN month_num := 10;
        WHEN 'nov', 'november', '11' THEN month_num := 11;
        WHEN 'dec', 'december', '12' THEN month_num := 12;
        ELSE month_num := 1;
    END CASE;

    RETURN pg_catalog.make_date(y, month_num, 1);
END;
$$;


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
  exp_idx integer := 1;
  edu_idx integer := 1;
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
        author_id,
        title,
        type,
        company,
        start_month,
        start_year,
        end_month,
        end_year,
        currently_in,
        location,
        loc_type,
        description,
        sort_order
      ) VALUES (
        p_author_id,
        COALESCE(exp_item->>'title', ''),
        COALESCE(exp_item->>'type', ''),
        COALESCE(exp_item->>'company', ''),
        COALESCE(exp_item->>'start_month', ''),
        COALESCE((exp_item->>'start_year')::integer, extract(year from now())::integer),
        NULLIF(exp_item->>'end_month', ''),
        CASE WHEN exp_item->>'end_year' IS NULL OR exp_item->>'end_year' = 'null' OR exp_item->>'end_year' = '' THEN NULL
             ELSE (exp_item->>'end_year')::integer END,
        COALESCE((exp_item->>'currently_in')::boolean, false),
        COALESCE(exp_item->>'location', ''),
        COALESCE(exp_item->>'loc_type', ''),
        COALESCE(exp_item->>'description', ''),
        COALESCE((exp_item->>'sort_order')::integer, exp_idx)
      );
      exp_idx := exp_idx + 1;
    END LOOP;
  END IF;

  IF p_education IS NOT NULL AND jsonb_array_length(p_education) > 0 THEN
    FOR edu_item IN SELECT * FROM jsonb_array_elements(p_education)
    LOOP
      INSERT INTO public.db_educations (
        author_id,
        institution,
        degree,
        field,
        start_month,
        start_year,
        end_month,
        end_year,
        currently_in,
        grade,
        description,
        sort_order
      ) VALUES (
        p_author_id,
        COALESCE(edu_item->>'institution', ''),
        COALESCE(edu_item->>'degree', ''),
        COALESCE(edu_item->>'field', ''),
        COALESCE(edu_item->>'start_month', 'September'),
        COALESCE((edu_item->>'start_year')::integer, extract(year from now())::integer),
        NULLIF(edu_item->>'end_month', ''),
        CASE WHEN edu_item->>'end_year' IS NULL OR edu_item->>'end_year' = 'null' OR edu_item->>'end_year' = '' THEN NULL
             ELSE (edu_item->>'end_year')::integer END,
        COALESCE((edu_item->>'currently_in')::boolean, false),
        COALESCE(edu_item->>'grade', ''),
        COALESCE(edu_item->>'description', ''),
        COALESCE((edu_item->>'sort_order')::integer, edu_idx)
      );
      edu_idx := edu_idx + 1;
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.db_save_cv(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.db_save_cv(uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.db_save_cv(uuid, jsonb, jsonb) TO authenticated;
