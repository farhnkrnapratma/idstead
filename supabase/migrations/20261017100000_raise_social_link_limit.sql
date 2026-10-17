CREATE OR REPLACE FUNCTION public.db_link_category_limit(p_category text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_category
    WHEN 'contact' THEN 10
    WHEN 'funding' THEN 10
    WHEN 'social' THEN 10
  END
$$;

REVOKE ALL ON FUNCTION public.db_link_category_limit(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.db_link_category_limit(text) FROM anon, authenticated;
