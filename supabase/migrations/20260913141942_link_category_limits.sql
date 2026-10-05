CREATE OR REPLACE FUNCTION public.db_link_category_limit(p_category text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_category
    WHEN 'contact' THEN 10
    WHEN 'funding' THEN 10
    WHEN 'social' THEN 6
  END
$$;

REVOKE ALL ON FUNCTION public.db_link_category_limit(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.db_link_category_limit(text) FROM anon, authenticated;

DO $$
DECLARE
  offender record;
BEGIN
  SELECT author_id, category, count(*) AS total
  INTO offender
  FROM public.db_links
  WHERE public.db_link_category_limit(category) IS NOT NULL
  GROUP BY author_id, category
  HAVING count(*) > public.db_link_category_limit(category)
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'LINK_CATEGORY_LIMIT: author % has % % links, the limit is %. Remove the extra links before applying this migration.',
      offender.author_id,
      offender.total,
      offender.category,
      public.db_link_category_limit(offender.category);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.db_enforce_link_category_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_limit integer := public.db_link_category_limit(NEW.category);
  total integer;
BEGIN
  IF link_limit IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('db_links:' || NEW.author_id::text || ':' || NEW.category)
  );

  SELECT count(*)
  INTO total
  FROM public.db_links
  WHERE author_id = NEW.author_id AND category = NEW.category;

  IF total > link_limit THEN
    RAISE EXCEPTION 'LINK_CATEGORY_LIMIT: % allows at most % links', NEW.category, link_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.db_enforce_link_category_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.db_enforce_link_category_limit() FROM anon, authenticated;

DROP TRIGGER IF EXISTS db_links_category_limit ON public.db_links;

CREATE CONSTRAINT TRIGGER db_links_category_limit
AFTER INSERT OR UPDATE OF author_id, category ON public.db_links
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.db_enforce_link_category_limit();

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
  link_limit integer := public.db_link_category_limit(p_category);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  IF link_limit IS NOT NULL
    AND p_items IS NOT NULL
    AND jsonb_array_length(p_items) > link_limit THEN
    RAISE EXCEPTION 'LINK_CATEGORY_LIMIT: % allows at most % links', p_category, link_limit
      USING ERRCODE = 'check_violation';
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
