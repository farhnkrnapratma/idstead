PRAGMA defer_foreign_keys = on;

CREATE TABLE db_cache_generations (
    domain TEXT PRIMARY KEY,
    gen INTEGER NOT NULL DEFAULT 0 CHECK (gen >= 0)
);

INSERT INTO db_cache_generations (domain, gen) VALUES ('author', 0), ('blog', 0), ('legal', 0);

CREATE TABLE db_identity_versions (
    id TEXT PRIMARY KEY,
    profile_id TEXT REFERENCES db_profiles (id) ON DELETE SET NULL,
    assets TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(assets) AND json_type(assets) = 'array'),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    retired_at TEXT,
    cleanup_started_at TEXT,
    kind TEXT NOT NULL DEFAULT 'identity' CHECK (kind = 'identity'),
    source TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('custom', 'generated')),
    fingerprint TEXT CHECK (fingerprint IS NULL OR (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*')),
    avatar_source TEXT CHECK (avatar_source IN ('custom', 'generated')),
    avatar_fingerprint TEXT CHECK (avatar_fingerprint IS NULL OR (length(avatar_fingerprint) = 64 AND avatar_fingerprint NOT GLOB '*[^0-9a-f]*')),
    banner_source TEXT CHECK (banner_source IN ('custom', 'generated')),
    banner_fingerprint TEXT CHECK (banner_fingerprint IS NULL OR (length(banner_fingerprint) = 64 AND banner_fingerprint NOT GLOB '*[^0-9a-f]*')),
    CHECK ((source = 'generated') = (fingerprint IS NOT NULL)),
    CHECK (CASE WHEN avatar_source IS NULL THEN avatar_fingerprint IS NULL ELSE (avatar_source = 'generated') = (avatar_fingerprint IS NOT NULL) END),
    CHECK (CASE WHEN banner_source IS NULL THEN banner_fingerprint IS NULL ELSE (banner_source = 'generated') = (banner_fingerprint IS NOT NULL) END),
    CHECK (kind <> 'identity' OR (avatar_source IS NOT NULL AND banner_source IS NOT NULL))
);

CREATE INDEX db_identity_versions_profile_idx ON db_identity_versions (profile_id);
CREATE INDEX db_identity_versions_retired_idx ON db_identity_versions (retired_at) WHERE retired_at IS NOT NULL;

CREATE TABLE db_profiles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    headline TEXT NOT NULL,
    job_title TEXT NOT NULL,
    bio TEXT NOT NULL,
    avatar TEXT NOT NULL,
    email TEXT NOT NULL,
    city TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL,
    site_url TEXT NOT NULL,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    profile_revision INTEGER NOT NULL DEFAULT 0,
    avatar_version TEXT REFERENCES db_identity_versions (id),
    manifest_settings TEXT NOT NULL DEFAULT '{"display":"standalone","theme_color":"#09090b","background_color":"#09090b"}' CHECK (
        json_valid(manifest_settings) AND json_type(manifest_settings) = 'object'
        AND length(json_extract(manifest_settings, '$.theme_color')) = 7 AND substr(json_extract(manifest_settings, '$.theme_color'), 1, 1) = '#' AND substr(json_extract(manifest_settings, '$.theme_color'), 2) NOT GLOB '*[^0-9a-fA-F]*'
        AND length(json_extract(manifest_settings, '$.background_color')) = 7 AND substr(json_extract(manifest_settings, '$.background_color'), 1, 1) = '#' AND substr(json_extract(manifest_settings, '$.background_color'), 2) NOT GLOB '*[^0-9a-fA-F]*'
        AND json_extract(manifest_settings, '$.display') IN ('standalone', 'minimal-ui', 'browser', 'fullscreen')
    ),
    pronunciation TEXT,
    banner_version TEXT REFERENCES db_identity_versions (id)
);

CREATE UNIQUE INDEX db_profiles_email_idx ON db_profiles (email);
CREATE UNIQUE INDEX db_profiles_username_idx ON db_profiles (username);
CREATE INDEX db_profiles_avatar_version_idx ON db_profiles (avatar_version);
CREATE INDEX db_profiles_banner_version_idx ON db_profiles (banner_version);

CREATE TABLE db_experiences (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    author_id TEXT NOT NULL REFERENCES db_profiles (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    company TEXT NOT NULL,
    start_month TEXT NOT NULL,
    start_year INTEGER NOT NULL,
    end_month TEXT,
    end_year INTEGER,
    currently_in INTEGER DEFAULT 0 CHECK (currently_in IN (0, 1)),
    location TEXT NOT NULL,
    loc_type TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    start_date TEXT GENERATED ALWAYS AS (CASE WHEN start_year IS NULL THEN NULL ELSE printf('%04d-%02d-01', start_year, CASE WHEN lower(trim(start_month)) IN ('jan', 'january', '01', '1') THEN 1 WHEN lower(trim(start_month)) IN ('feb', 'february', '02', '2') THEN 2 WHEN lower(trim(start_month)) IN ('mar', 'march', '03', '3') THEN 3 WHEN lower(trim(start_month)) IN ('apr', 'april', '04', '4') THEN 4 WHEN lower(trim(start_month)) IN ('may', '05', '5') THEN 5 WHEN lower(trim(start_month)) IN ('jun', 'june', '06', '6') THEN 6 WHEN lower(trim(start_month)) IN ('jul', 'july', '07', '7') THEN 7 WHEN lower(trim(start_month)) IN ('aug', 'august', '08', '8') THEN 8 WHEN lower(trim(start_month)) IN ('sep', 'september', '09', '9') THEN 9 WHEN lower(trim(start_month)) IN ('oct', 'october', '10') THEN 10 WHEN lower(trim(start_month)) IN ('nov', 'november', '11') THEN 11 WHEN lower(trim(start_month)) IN ('dec', 'december', '12') THEN 12 ELSE 1 END) END) VIRTUAL,
    end_date TEXT GENERATED ALWAYS AS (CASE WHEN end_month IS NOT NULL AND end_year IS NOT NULL THEN CASE WHEN end_year IS NULL THEN NULL ELSE printf('%04d-%02d-01', end_year, CASE WHEN lower(trim(end_month)) IN ('jan', 'january', '01', '1') THEN 1 WHEN lower(trim(end_month)) IN ('feb', 'february', '02', '2') THEN 2 WHEN lower(trim(end_month)) IN ('mar', 'march', '03', '3') THEN 3 WHEN lower(trim(end_month)) IN ('apr', 'april', '04', '4') THEN 4 WHEN lower(trim(end_month)) IN ('may', '05', '5') THEN 5 WHEN lower(trim(end_month)) IN ('jun', 'june', '06', '6') THEN 6 WHEN lower(trim(end_month)) IN ('jul', 'july', '07', '7') THEN 7 WHEN lower(trim(end_month)) IN ('aug', 'august', '08', '8') THEN 8 WHEN lower(trim(end_month)) IN ('sep', 'september', '09', '9') THEN 9 WHEN lower(trim(end_month)) IN ('oct', 'october', '10') THEN 10 WHEN lower(trim(end_month)) IN ('nov', 'november', '11') THEN 11 WHEN lower(trim(end_month)) IN ('dec', 'december', '12') THEN 12 ELSE 1 END) END END) VIRTUAL
);

CREATE INDEX idx_experiences_author_id ON db_experiences (author_id);

CREATE TABLE db_educations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    author_id TEXT NOT NULL REFERENCES db_profiles (id) ON DELETE CASCADE,
    institution TEXT NOT NULL,
    degree TEXT NOT NULL,
    field TEXT NOT NULL,
    start_month TEXT NOT NULL,
    start_year INTEGER NOT NULL,
    end_month TEXT,
    end_year INTEGER,
    currently_in INTEGER DEFAULT 0 CHECK (currently_in IN (0, 1)),
    grade TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    start_date TEXT GENERATED ALWAYS AS (CASE WHEN start_year IS NULL THEN NULL ELSE printf('%04d-%02d-01', start_year, CASE WHEN lower(trim(start_month)) IN ('jan', 'january', '01', '1') THEN 1 WHEN lower(trim(start_month)) IN ('feb', 'february', '02', '2') THEN 2 WHEN lower(trim(start_month)) IN ('mar', 'march', '03', '3') THEN 3 WHEN lower(trim(start_month)) IN ('apr', 'april', '04', '4') THEN 4 WHEN lower(trim(start_month)) IN ('may', '05', '5') THEN 5 WHEN lower(trim(start_month)) IN ('jun', 'june', '06', '6') THEN 6 WHEN lower(trim(start_month)) IN ('jul', 'july', '07', '7') THEN 7 WHEN lower(trim(start_month)) IN ('aug', 'august', '08', '8') THEN 8 WHEN lower(trim(start_month)) IN ('sep', 'september', '09', '9') THEN 9 WHEN lower(trim(start_month)) IN ('oct', 'october', '10') THEN 10 WHEN lower(trim(start_month)) IN ('nov', 'november', '11') THEN 11 WHEN lower(trim(start_month)) IN ('dec', 'december', '12') THEN 12 ELSE 1 END) END) VIRTUAL,
    end_date TEXT GENERATED ALWAYS AS (CASE WHEN end_month IS NOT NULL AND end_year IS NOT NULL THEN CASE WHEN end_year IS NULL THEN NULL ELSE printf('%04d-%02d-01', end_year, CASE WHEN lower(trim(end_month)) IN ('jan', 'january', '01', '1') THEN 1 WHEN lower(trim(end_month)) IN ('feb', 'february', '02', '2') THEN 2 WHEN lower(trim(end_month)) IN ('mar', 'march', '03', '3') THEN 3 WHEN lower(trim(end_month)) IN ('apr', 'april', '04', '4') THEN 4 WHEN lower(trim(end_month)) IN ('may', '05', '5') THEN 5 WHEN lower(trim(end_month)) IN ('jun', 'june', '06', '6') THEN 6 WHEN lower(trim(end_month)) IN ('jul', 'july', '07', '7') THEN 7 WHEN lower(trim(end_month)) IN ('aug', 'august', '08', '8') THEN 8 WHEN lower(trim(end_month)) IN ('sep', 'september', '09', '9') THEN 9 WHEN lower(trim(end_month)) IN ('oct', 'october', '10') THEN 10 WHEN lower(trim(end_month)) IN ('nov', 'november', '11') THEN 11 WHEN lower(trim(end_month)) IN ('dec', 'december', '12') THEN 12 ELSE 1 END) END END) VIRTUAL
);

CREATE INDEX idx_education_author_id ON db_educations (author_id);

CREATE TABLE db_categories (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    author_id TEXT NOT NULL REFERENCES db_profiles (id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_db_categories_author_id ON db_categories (author_id);

CREATE TABLE db_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    category_id TEXT NOT NULL REFERENCES db_categories (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_db_items_category_id ON db_items (category_id);

CREATE TABLE db_links (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    author_id TEXT NOT NULL REFERENCES db_profiles (id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('social', 'contact', 'funding')),
    platform TEXT NOT NULL,
    display_value TEXT,
    url TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'bi-link',
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_db_links_author_id ON db_links (author_id);
CREATE INDEX idx_db_links_category ON db_links (category);

CREATE TABLE db_project_repo_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    author_id TEXT NOT NULL REFERENCES db_profiles (id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('exclude', 'pin')),
    repo_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (author_id, rule_type, repo_name)
);

CREATE TABLE db_documents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    author_id TEXT NOT NULL REFERENCES db_profiles (id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    hash TEXT NOT NULL,
    is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    version TEXT CHECK (version IS NULL OR (version GLOB '[0-9]*.[0-9]*' AND version NOT GLOB '*[^0-9.]*' AND length(version) - length(replace(version, '.', '')) = 1)),
    signed_at TEXT,
    checksums TEXT CHECK (checksums IS NULL OR (json_valid(checksums) AND json_type(checksums) = 'object')),
    signer_fingerprint TEXT CHECK (signer_fingerprint IS NULL OR (length(signer_fingerprint) IN (40, 64) AND signer_fingerprint NOT GLOB '*[^0-9A-F]*'))
);

CREATE UNIQUE INDEX db_documents_active_idx ON db_documents (author_id) WHERE is_active = 1;
CREATE INDEX idx_cv_documents_author_id ON db_documents (author_id);

CREATE TABLE db_document_snapshots (
    document_id TEXT PRIMARY KEY REFERENCES db_documents (id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE db_openpgp_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    fingerprint TEXT NOT NULL UNIQUE CHECK (length(fingerprint) IN (40, 64) AND fingerprint NOT GLOB '*[^0-9A-F]*'),
    armored TEXT NOT NULL CHECK (length(armored) <= 65536 AND armored GLOB '-----BEGIN PGP PUBLIC KEY BLOCK-----*'),
    user_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(user_ids) AND json_type(user_ids) = 'array'),
    algorithm TEXT NOT NULL DEFAULT '',
    key_created_at TEXT,
    expires_at TEXT,
    keyservers TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(keyservers) AND json_type(keyservers) = 'array' AND json_array_length(keyservers) <= 8),
    is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX db_openpgp_keys_one_active ON db_openpgp_keys (is_active) WHERE is_active = 1;

CREATE TABLE db_legals (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE db_blog_banner_versions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
    bytes INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 512000),
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'staged', 'active', 'retired', 'cleaning', 'deleted')),
    retain INTEGER NOT NULL DEFAULT 0 CHECK (retain IN (0, 1)),
    source_path TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    retired_at TEXT,
    cleanup_attempts INTEGER NOT NULL DEFAULT 0,
    cleanup_error TEXT,
    CHECK (object_key = 'blog/banners/' || post_id || '/' || id || '.webp')
);

CREATE INDEX db_blog_banner_post_idx ON db_blog_banner_versions (post_id);
CREATE INDEX db_blog_banner_cleanup_idx ON db_blog_banner_versions (retired_at) WHERE state IN ('retired', 'cleaning') AND retain = 0;

CREATE TABLE db_posts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    slug TEXT NOT NULL UNIQUE CHECK (slug <> '' AND slug NOT GLOB '*[^a-z-]*'),
    title TEXT NOT NULL CHECK (length(title) <= 60),
    excerpt TEXT,
    published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
    storage_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    banner_path TEXT,
    read_time INTEGER,
    tags TEXT CHECK (tags IS NULL OR (json_valid(tags) AND json_type(tags) = 'array' AND json_array_length(tags) <= 5)),
    collaborators TEXT DEFAULT '[]' CHECK (collaborators IS NULL OR json_valid(collaborators) AND json_type(collaborators) = 'array'),
    summary TEXT,
    tldr TEXT CHECK (tldr IS NULL OR (json_valid(tldr) AND json_type(tldr) = 'array' AND json_array_length(tldr) <= 4)),
    pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
    post_revision INTEGER NOT NULL DEFAULT 0,
    banner_version TEXT REFERENCES db_blog_banner_versions (id),
    subscribers_notified_at TEXT,
    public_id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(32)))) CHECK (length(public_id) = 64 AND public_id NOT GLOB '*[^0-9a-f]*')
);

CREATE INDEX db_posts_banner_version_idx ON db_posts (banner_version) WHERE banner_version IS NOT NULL;
CREATE INDEX db_posts_published_created_idx ON db_posts (published, pinned, created_at DESC);

CREATE TABLE db_post_stats (
    post_id TEXT PRIMARY KEY REFERENCES db_posts (id) ON DELETE CASCADE,
    view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    helpful_yes INTEGER NOT NULL DEFAULT 0 CHECK (helpful_yes >= 0),
    helpful_no INTEGER NOT NULL DEFAULT 0 CHECK (helpful_no >= 0)
);

CREATE TABLE db_blog_banner_references (
    post_id TEXT NOT NULL REFERENCES db_posts (id) ON DELETE CASCADE,
    version_id TEXT NOT NULL REFERENCES db_blog_banner_versions (id),
    PRIMARY KEY (post_id, version_id)
);

CREATE INDEX db_blog_banner_references_version_idx ON db_blog_banner_references (version_id);

CREATE TABLE db_post_operations (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    request_hash TEXT NOT NULL CHECK (length(request_hash) = 64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
    expected_revision INTEGER,
    kind TEXT NOT NULL CHECK (kind IN ('save', 'delete')),
    post_data TEXT NOT NULL CHECK (json_valid(post_data)),
    banner_operation TEXT NOT NULL CHECK (banner_operation IN ('keep', 'replace', 'remove')),
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready', 'committed', 'conflict', 'rejected')),
    result TEXT CHECK (result IS NULL OR json_valid(result)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    committed_at TEXT
);

CREATE INDEX db_post_operations_post_idx ON db_post_operations (post_id);

CREATE TABLE db_post_storage_cleanup (
    storage_path TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    cleanup_attempts INTEGER NOT NULL DEFAULT 0,
    cleanup_error TEXT
);

CREATE TABLE db_comments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    post_id TEXT NOT NULL REFERENCES db_posts (id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_approved INTEGER NOT NULL DEFAULT 0 CHECK (is_approved IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    parent_id TEXT REFERENCES db_comments (id) ON DELETE CASCADE,
    is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
    is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
    public_id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(32)))) CHECK (length(public_id) = 64 AND public_id NOT GLOB '*[^0-9a-f]*'),
    CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX comments_parent_id_idx ON db_comments (parent_id);
CREATE INDEX comments_post_parent_created_idx ON db_comments (post_id, parent_id, created_at);
CREATE INDEX db_comments_post_page_idx ON db_comments (post_id, created_at DESC, id DESC);

CREATE TABLE db_comment_reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    comment_id TEXT NOT NULL REFERENCES db_comments (id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    reporter_ip_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX db_comment_reports_comment_id_idx ON db_comment_reports (comment_id);
CREATE INDEX db_reports_comment_reason_page_idx ON db_comment_reports (comment_id, reason, created_at DESC, id DESC);
CREATE INDEX db_reports_created_page_idx ON db_comment_reports (created_at DESC, id DESC);

CREATE TABLE db_views (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    post_id TEXT NOT NULL REFERENCES db_posts (id) ON DELETE CASCADE,
    ip_hash TEXT NOT NULL,
    viewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (post_id, ip_hash)
);

CREATE INDEX db_views_viewed_at_idx ON db_views (viewed_at DESC);

CREATE TABLE db_post_feedback (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    post_id TEXT NOT NULL REFERENCES db_posts (id) ON DELETE CASCADE,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
    ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX db_post_feedback_created_at_idx ON db_post_feedback (created_at DESC);
CREATE INDEX db_post_feedback_post_id_idx ON db_post_feedback (post_id);

CREATE TABLE db_feedback_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    target_type TEXT NOT NULL CHECK (target_type IN ('article', 'legal')),
    target_id TEXT NOT NULL,
    post_id TEXT REFERENCES db_posts (id) ON DELETE CASCADE,
    page_title TEXT NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
    ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    legacy_id TEXT UNIQUE
);

CREATE INDEX db_feedback_created_page_idx ON db_feedback_events (created_at DESC, id DESC);
CREATE INDEX db_feedback_events_page_idx ON db_feedback_events (target_type, target_id, created_at DESC, id DESC);
CREATE INDEX db_feedback_events_post_id_idx ON db_feedback_events (post_id);
CREATE INDEX db_feedback_events_quota_idx ON db_feedback_events (target_type, target_id, ip_hash, created_at DESC);

CREATE TABLE db_feedback_operations (
    operation_id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL CHECK (target_type IN ('article', 'legal')),
    target_id TEXT NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
    ip_hash TEXT NOT NULL,
    recorded INTEGER NOT NULL CHECK (recorded IN (0, 1)),
    event_id TEXT REFERENCES db_feedback_events (id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX db_feedback_operations_event_id_idx ON db_feedback_operations (event_id);

CREATE TABLE db_admin_notifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    kind TEXT NOT NULL CHECK (kind IN ('comment_report', 'comment_new', 'post_feedback', 'legal_feedback', 'contact_message', 'feedback_report')),
    post_id TEXT REFERENCES db_posts (id) ON DELETE CASCADE,
    comment_id TEXT REFERENCES db_comments (id) ON DELETE SET NULL,
    source_id TEXT,
    meta TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(meta) AND json_type(meta) = 'object'),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    read_at TEXT,
    dismissed_at TEXT,
    pinned_at TEXT
);

CREATE INDEX db_admin_notifications_comment_id_idx ON db_admin_notifications (comment_id);
CREATE INDEX db_admin_notifications_inbox_idx ON db_admin_notifications (dismissed_at, created_at DESC);
CREATE INDEX db_admin_notifications_pinned_at_idx ON db_admin_notifications (pinned_at DESC);
CREATE INDEX db_admin_notifications_post_id_idx ON db_admin_notifications (post_id);
CREATE UNIQUE INDEX db_admin_notifications_source_idx ON db_admin_notifications (kind, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX db_notifications_active_page_idx ON db_admin_notifications (created_at DESC, id DESC) WHERE dismissed_at IS NULL;
CREATE INDEX db_notifications_unread_page_idx ON db_admin_notifications (created_at DESC, id DESC) WHERE dismissed_at IS NULL AND read_at IS NULL;

CREATE TABLE db_notification_clear_operations (
    operation_id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    target_ids TEXT NOT NULL CHECK (json_valid(target_ids) AND json_type(target_ids) = 'array'),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    completed_at TEXT,
    deleted_count INTEGER
);

CREATE TABLE db_subscribers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed')),
    confirm_token_hash TEXT,
    unsubscribe_token TEXT NOT NULL,
    confirm_sent_at TEXT,
    confirmed_at TEXT,
    unsubscribed_at TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX db_subscribers_active_idx ON db_subscribers (status) WHERE status = 'active';
CREATE INDEX db_subscribers_pending_created_idx ON db_subscribers (created_at) WHERE status = 'pending';
CREATE UNIQUE INDEX db_subscribers_confirm_token_key ON db_subscribers (confirm_token_hash) WHERE confirm_token_hash IS NOT NULL;
CREATE UNIQUE INDEX db_subscribers_email_key ON db_subscribers (lower(email));
CREATE UNIQUE INDEX db_subscribers_unsubscribe_token_idx ON db_subscribers (unsubscribe_token);

CREATE TABLE db_activity_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    actor TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('profile', 'cv', 'skills', 'links', 'blog', 'auth', 'security')),
    entity_id TEXT,
    summary TEXT NOT NULL,
    details TEXT CHECK (details IS NULL OR json_valid(details)),
    ip_hash TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ip TEXT
);

CREATE INDEX db_activity_log_category_time_id_idx ON db_activity_log (category, created_at DESC, id DESC);
CREATE INDEX db_activity_log_time_id_idx ON db_activity_log (created_at DESC, id DESC);

CREATE TABLE db_admin_settings (
    user_id TEXT PRIMARY KEY,
    settings TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings) AND json_type(settings) = 'object' AND length(settings) <= 4096),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE db_ard_index (
    site_url TEXT PRIMARY KEY CHECK (length(site_url) <= 2048),
    entries TEXT NOT NULL CHECK (json_valid(entries) AND json_type(entries) = 'array' AND json_array_length(entries) <= 1000 AND length(entries) <= 4194304),
    sources TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(sources) AND json_type(sources) = 'array' AND json_array_length(sources) <= 32),
    indexed_at TEXT NOT NULL
);

CREATE TABLE db_login_failures (
    id INTEGER PRIMARY KEY,
    key_hash TEXT NOT NULL CHECK (length(key_hash) = 64 AND key_hash NOT GLOB '*[^0-9a-f]*'),
    failed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX db_login_failures_failed_at_idx ON db_login_failures (failed_at);
CREATE INDEX db_login_failures_key_hash_failed_at_idx ON db_login_failures (key_hash, failed_at);

CREATE TRIGGER db_profiles_revision AFTER UPDATE ON db_profiles
WHEN NEW.profile_revision IS OLD.profile_revision
BEGIN
    UPDATE db_profiles SET profile_revision = OLD.profile_revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER db_profiles_identity_kind BEFORE UPDATE OF avatar_version, banner_version ON db_profiles
WHEN (NEW.avatar_version IS NOT OLD.avatar_version AND NEW.avatar_version IS NOT NULL AND NOT EXISTS (SELECT 1 FROM db_identity_versions v WHERE v.id = NEW.avatar_version AND v.kind IN ('avatar', 'identity')))
    OR (NEW.banner_version IS NOT OLD.banner_version AND NEW.banner_version IS NOT NULL AND NOT EXISTS (SELECT 1 FROM db_identity_versions v WHERE v.id = NEW.banner_version AND v.kind IN ('banner', 'identity')))
    OR (NEW.avatar_version IS NOT NEW.banner_version AND EXISTS (SELECT 1 FROM db_identity_versions v WHERE v.kind = 'identity' AND v.id IN (NEW.avatar_version, NEW.banner_version)))
BEGIN
    SELECT RAISE(ABORT, 'Profile image and website banner must reference one identity package');
END;

CREATE TRIGGER db_profiles_retire_images BEFORE DELETE ON db_profiles
BEGIN
    UPDATE db_identity_versions SET retired_at = coalesce(retired_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE profile_id = OLD.id;
END;

CREATE TRIGGER db_documents_updated_at AFTER UPDATE ON db_documents
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE db_documents SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER db_links_category_limit_insert AFTER INSERT ON db_links
WHEN (SELECT count(*) FROM db_links WHERE author_id = NEW.author_id AND category = NEW.category) > 10
BEGIN
    SELECT RAISE(ABORT, 'LINK_CATEGORY_LIMIT: a link category allows at most 10 links');
END;

CREATE TRIGGER db_links_category_limit_update AFTER UPDATE OF author_id, category ON db_links
WHEN (SELECT count(*) FROM db_links WHERE author_id = NEW.author_id AND category = NEW.category) > 10
BEGIN
    SELECT RAISE(ABORT, 'LINK_CATEGORY_LIMIT: a link category allows at most 10 links');
END;

CREATE TRIGGER db_posts_validate_lists_insert BEFORE INSERT ON db_posts
WHEN EXISTS (SELECT 1 FROM json_each(coalesce(NEW.tags, '[]')) WHERE type <> 'text' OR length(value) > 30)
    OR EXISTS (SELECT 1 FROM json_each(coalesce(NEW.tldr, '[]')) WHERE type <> 'text' OR length(value) > 200)
BEGIN
    SELECT RAISE(ABORT, 'Tags allow at most 30 characters and TL;DR points at most 200');
END;

CREATE TRIGGER db_posts_validate_lists_update BEFORE UPDATE OF tags, tldr ON db_posts
WHEN EXISTS (SELECT 1 FROM json_each(coalesce(NEW.tags, '[]')) WHERE type <> 'text' OR length(value) > 30)
    OR EXISTS (SELECT 1 FROM json_each(coalesce(NEW.tldr, '[]')) WHERE type <> 'text' OR length(value) > 200)
BEGIN
    SELECT RAISE(ABORT, 'Tags allow at most 30 characters and TL;DR points at most 200');
END;

CREATE TRIGGER db_posts_create_stats AFTER INSERT ON db_posts
BEGIN
    INSERT OR IGNORE INTO db_post_stats (post_id) VALUES (NEW.id);
END;

CREATE TRIGGER db_posts_keep_public_id BEFORE UPDATE OF public_id ON db_posts
WHEN NEW.public_id IS NOT OLD.public_id
BEGIN
    SELECT RAISE(ABORT, 'public_id is immutable');
END;

CREATE TRIGGER db_comments_keep_public_id BEFORE UPDATE OF public_id ON db_comments
WHEN NEW.public_id IS NOT OLD.public_id
BEGIN
    SELECT RAISE(ABORT, 'public_id is immutable');
END;

CREATE TRIGGER db_posts_excerpt_on_insert BEFORE INSERT ON db_posts
WHEN NEW.published = 1 AND trim(coalesce(NEW.excerpt, '')) = ''
BEGIN
    SELECT RAISE(ABORT, 'Excerpt is required to publish a post.');
END;

CREATE TRIGGER db_posts_excerpt_on_update BEFORE UPDATE OF published, excerpt ON db_posts
WHEN NEW.published = 1 AND trim(coalesce(NEW.excerpt, '')) = ''
    AND (OLD.published IS NOT NEW.published OR OLD.excerpt IS NOT NEW.excerpt)
BEGIN
    SELECT RAISE(ABORT, 'Excerpt is required to publish a post.');
END;

CREATE TRIGGER db_posts_pin_limit_insert BEFORE INSERT ON db_posts
WHEN NEW.pinned = 1 AND (SELECT count(*) FROM db_posts WHERE pinned = 1) >= 3
BEGIN
    SELECT RAISE(ABORT, 'Maximum of 3 pinned posts allowed');
END;

CREATE TRIGGER db_posts_pin_limit_update BEFORE UPDATE OF pinned ON db_posts
WHEN NEW.pinned = 1 AND OLD.pinned = 0 AND (SELECT count(*) FROM db_posts WHERE pinned = 1) >= 3
BEGIN
    SELECT RAISE(ABORT, 'Maximum of 3 pinned posts allowed');
END;

CREATE TRIGGER db_posts_revision AFTER UPDATE ON db_posts
WHEN NEW.post_revision IS OLD.post_revision AND (
    NEW.title IS NOT OLD.title OR NEW.slug IS NOT OLD.slug OR NEW.excerpt IS NOT OLD.excerpt
    OR NEW.tags IS NOT OLD.tags OR NEW.collaborators IS NOT OLD.collaborators
    OR NEW.published IS NOT OLD.published OR NEW.pinned IS NOT OLD.pinned
    OR NEW.storage_path IS NOT OLD.storage_path OR NEW.banner_path IS NOT OLD.banner_path
    OR NEW.banner_version IS NOT OLD.banner_version OR NEW.summary IS NOT OLD.summary
    OR NEW.tldr IS NOT OLD.tldr
)
BEGIN
    UPDATE db_posts SET post_revision = OLD.post_revision + 1 WHERE id = NEW.id;
END;

CREATE TRIGGER db_posts_cleanup_feedback_operations BEFORE DELETE ON db_posts
BEGIN
    DELETE FROM db_feedback_operations WHERE target_type = 'article' AND target_id = OLD.id;
END;

CREATE TRIGGER db_views_count_insert AFTER INSERT ON db_views
BEGIN
    INSERT OR IGNORE INTO db_post_stats (post_id) VALUES (NEW.post_id);
    UPDATE db_post_stats SET view_count = view_count + 1 WHERE post_id = NEW.post_id;
END;

CREATE TRIGGER db_views_count_delete AFTER DELETE ON db_views
BEGIN
    UPDATE db_post_stats SET view_count = max(view_count - 1, 0) WHERE post_id = OLD.post_id;
END;

CREATE TRIGGER db_comments_notify AFTER INSERT ON db_comments
WHEN NEW.is_admin = 0
BEGIN
    INSERT INTO db_admin_notifications (kind, post_id, comment_id, source_id, meta, created_at)
    SELECT 'comment_new', NEW.post_id, NEW.id, NEW.id, json_object(
        'author', CASE WHEN NEW.is_anonymous = 1 OR NEW.author_name IS NULL THEN 'Anonymous' ELSE NEW.author_name END,
        'comment', NEW.content,
        'page_type', 'article',
        'page_id', p.id,
        'page_title', p.title
    ), NEW.created_at
    FROM db_posts p
    WHERE p.id = NEW.post_id
        AND NOT EXISTS (SELECT 1 FROM db_admin_notifications n WHERE n.kind = 'comment_new' AND n.source_id = NEW.id);
END;

CREATE TRIGGER db_comment_reports_notify AFTER INSERT ON db_comment_reports
BEGIN
    INSERT INTO db_admin_notifications (kind, post_id, comment_id, source_id, meta, created_at)
    SELECT 'comment_report', c.post_id, c.id, NEW.id, json_object(
        'reason', NEW.reason,
        'details', NEW.details,
        'author', CASE WHEN c.is_anonymous = 1 OR c.author_name IS NULL THEN 'Anonymous' ELSE c.author_name END,
        'comment', c.content,
        'page_type', 'article',
        'page_id', p.id,
        'page_title', p.title
    ), NEW.created_at
    FROM db_comments c JOIN db_posts p ON p.id = c.post_id
    WHERE c.id = NEW.comment_id
        AND NOT EXISTS (SELECT 1 FROM db_admin_notifications n WHERE n.kind = 'comment_report' AND n.source_id = NEW.id);
END;

CREATE TRIGGER db_feedback_events_notify AFTER INSERT ON db_feedback_events
BEGIN
    INSERT INTO db_admin_notifications (kind, post_id, source_id, meta, created_at)
    SELECT CASE WHEN NEW.target_type = 'article' THEN 'post_feedback' ELSE 'legal_feedback' END,
        NEW.post_id, NEW.id, json_object(
            'vote', NEW.vote,
            'page_type', NEW.target_type,
            'page_id', NEW.target_id,
            'page_title', NEW.page_title
        ), NEW.created_at
    WHERE NOT EXISTS (
        SELECT 1 FROM db_admin_notifications n
        WHERE n.source_id = NEW.id
            AND n.kind = CASE WHEN NEW.target_type = 'article' THEN 'post_feedback' ELSE 'legal_feedback' END
    );
END;

CREATE TRIGGER db_post_feedback_event AFTER INSERT ON db_post_feedback
BEGIN
    INSERT OR IGNORE INTO db_feedback_events (id, target_type, target_id, post_id, page_title, vote, ip_hash, created_at, legacy_id)
    SELECT NEW.id, 'article', NEW.post_id, NEW.post_id, p.title, NEW.vote, NEW.ip_hash, NEW.created_at, NEW.id
    FROM db_posts p WHERE p.id = NEW.post_id;
END;

CREATE TRIGGER db_profiles_cache_insert AFTER INSERT ON db_profiles
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_profiles_cache_update AFTER UPDATE ON db_profiles
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_profiles_cache_delete AFTER DELETE ON db_profiles
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_links_cache_insert AFTER INSERT ON db_links
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_links_cache_update AFTER UPDATE ON db_links
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_links_cache_delete AFTER DELETE ON db_links
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_experiences_cache_insert AFTER INSERT ON db_experiences
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_experiences_cache_update AFTER UPDATE ON db_experiences
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_experiences_cache_delete AFTER DELETE ON db_experiences
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_educations_cache_insert AFTER INSERT ON db_educations
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_educations_cache_update AFTER UPDATE ON db_educations
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_educations_cache_delete AFTER DELETE ON db_educations
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_categories_cache_insert AFTER INSERT ON db_categories
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_categories_cache_update AFTER UPDATE ON db_categories
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_categories_cache_delete AFTER DELETE ON db_categories
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_items_cache_insert AFTER INSERT ON db_items
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_items_cache_update AFTER UPDATE ON db_items
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_items_cache_delete AFTER DELETE ON db_items
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_project_repo_rules_cache_insert AFTER INSERT ON db_project_repo_rules
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_project_repo_rules_cache_update AFTER UPDATE ON db_project_repo_rules
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_project_repo_rules_cache_delete AFTER DELETE ON db_project_repo_rules
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_documents_cache_insert AFTER INSERT ON db_documents
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_documents_cache_update AFTER UPDATE ON db_documents
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_documents_cache_delete AFTER DELETE ON db_documents
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_openpgp_keys_cache_insert AFTER INSERT ON db_openpgp_keys
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_openpgp_keys_cache_update AFTER UPDATE ON db_openpgp_keys
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_openpgp_keys_cache_delete AFTER DELETE ON db_openpgp_keys
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_identity_versions_cache_insert AFTER INSERT ON db_identity_versions
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_identity_versions_cache_update AFTER UPDATE ON db_identity_versions
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_identity_versions_cache_delete AFTER DELETE ON db_identity_versions
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'author';
END;

CREATE TRIGGER db_posts_cache_insert AFTER INSERT ON db_posts
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'blog';
END;

CREATE TRIGGER db_posts_cache_update AFTER UPDATE ON db_posts
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'blog';
END;

CREATE TRIGGER db_posts_cache_delete AFTER DELETE ON db_posts
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'blog';
END;

CREATE TRIGGER db_legals_cache_insert AFTER INSERT ON db_legals
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'legal';
END;

CREATE TRIGGER db_legals_cache_update AFTER UPDATE ON db_legals
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'legal';
END;

CREATE TRIGGER db_legals_cache_delete AFTER DELETE ON db_legals
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'legal';
END;

CREATE TRIGGER db_comments_cache_insert AFTER INSERT ON db_comments
BEGIN
    INSERT OR IGNORE INTO db_cache_generations (domain, gen) VALUES ('comments:' || NEW.post_id, 0);
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'comments:' || NEW.post_id;
END;

CREATE TRIGGER db_comments_cache_update AFTER UPDATE ON db_comments
BEGIN
    INSERT OR IGNORE INTO db_cache_generations (domain, gen) VALUES ('comments:' || NEW.post_id, 0);
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'comments:' || NEW.post_id;
END;

CREATE TRIGGER db_comments_cache_delete AFTER DELETE ON db_comments
BEGIN
    INSERT OR IGNORE INTO db_cache_generations (domain, gen) VALUES ('comments:' || OLD.post_id, 0);
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'comments:' || OLD.post_id;
END;
