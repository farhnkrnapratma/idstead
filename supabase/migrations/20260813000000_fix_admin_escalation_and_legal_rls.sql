







DROP FUNCTION IF EXISTS public.grant_admin_role_by_email(text);









DROP POLICY IF EXISTS "Authenticated users manage legal pages" ON public.db_legals;

CREATE POLICY "Admins manage legal pages"
  ON public.db_legals
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
