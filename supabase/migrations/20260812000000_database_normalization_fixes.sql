-- Normalization Fixes & Database Performance Improvements

-- 1. Deduplicate db_views (keep oldest row per post_id + ip_hash)
DELETE FROM public.db_views a USING public.db_views b
WHERE a.id > b.id
  AND a.post_id = b.post_id
  AND a.ip_hash = b.ip_hash;

-- 2. Prevent Duplicate View Insertion Anomaly (ON CONFLICT post_id, ip_hash)
CREATE UNIQUE INDEX IF NOT EXISTS db_views_post_ip_idx ON public.db_views (post_id, ip_hash);

-- 3. Prevent Duplicate Profile Identity Anomaly (Unique Username & Email)
CREATE UNIQUE INDEX IF NOT EXISTS db_profiles_username_idx ON public.db_profiles (username);
CREATE UNIQUE INDEX IF NOT EXISTS db_profiles_email_idx ON public.db_profiles (email);

-- 4. Enforce Single Active Document per Author (Partial Unique Index)
CREATE UNIQUE INDEX IF NOT EXISTS db_documents_active_idx ON public.db_documents (author_id) WHERE is_active = true;

-- 5. Foreign Key B-Tree Indexes for Fast Cascades & Joins
CREATE INDEX IF NOT EXISTS idx_db_links_author_id ON public.db_links (author_id);
CREATE INDEX IF NOT EXISTS idx_db_links_category ON public.db_links (category);
CREATE INDEX IF NOT EXISTS idx_db_categories_author_id ON public.db_categories (author_id);
CREATE INDEX IF NOT EXISTS idx_db_items_category_id ON public.db_items (category_id);
