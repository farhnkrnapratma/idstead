


DELETE FROM public.db_views a USING public.db_views b
WHERE a.id > b.id
  AND a.post_id = b.post_id
  AND a.ip_hash = b.ip_hash;


CREATE UNIQUE INDEX IF NOT EXISTS db_views_post_ip_idx ON public.db_views (post_id, ip_hash);


CREATE UNIQUE INDEX IF NOT EXISTS db_profiles_username_idx ON public.db_profiles (username);
CREATE UNIQUE INDEX IF NOT EXISTS db_profiles_email_idx ON public.db_profiles (email);


CREATE UNIQUE INDEX IF NOT EXISTS db_documents_active_idx ON public.db_documents (author_id) WHERE is_active = true;


CREATE INDEX IF NOT EXISTS idx_db_links_author_id ON public.db_links (author_id);
CREATE INDEX IF NOT EXISTS idx_db_links_category ON public.db_links (category);
CREATE INDEX IF NOT EXISTS idx_db_categories_author_id ON public.db_categories (author_id);
CREATE INDEX IF NOT EXISTS idx_db_items_category_id ON public.db_items (category_id);
