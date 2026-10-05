UPDATE public.db_comments
SET is_admin = false
WHERE is_admin = true
  AND (
    author_name ILIKE '%Adam Smith%'
    OR author_name NOT IN (SELECT name FROM public.db_profiles)
  );
