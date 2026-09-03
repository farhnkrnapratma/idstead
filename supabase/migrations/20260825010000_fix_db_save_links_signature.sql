CREATE OR REPLACE FUNCTION public.db_save_links(
  p_author_id uuid,
  p_category text,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  idx integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  DELETE FROM public.db_links
  WHERE author_id = p_author_id AND category = p_category;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.db_links (
        author_id, category, platform, display_value, url, icon, description, sort_order
      ) VALUES (
        p_author_id,
        p_category,
        item->>'platform',
        NULLIF(item->>'display_value', ''),
        item->>'url',
        COALESCE(NULLIF(item->>'icon', ''), 'bi-link'),
        NULLIF(item->>'description', ''),
        COALESCE((item->>'sort_order')::integer, idx)
      );
      idx := idx + 1;
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.db_save_links(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.db_save_links(uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.db_save_links(uuid, text, jsonb) TO authenticated;
