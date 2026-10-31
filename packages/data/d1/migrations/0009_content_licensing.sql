ALTER TABLE db_posts ADD COLUMN content_license TEXT CHECK (content_license IS NULL OR content_license IN ('all-rights-reserved', 'CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-ND-4.0', 'CC-BY-NC-ND-4.0'));

ALTER TABLE db_posts ADD COLUMN banner_credit TEXT CHECK (banner_credit IS NULL OR (json_valid(banner_credit) AND json_type(banner_credit) = 'object' AND json_extract(banner_credit, '$.origin') IN ('third-party', 'ai-generated') AND length(banner_credit) <= 600));

DROP TRIGGER db_posts_revision;

CREATE TRIGGER db_posts_revision AFTER UPDATE ON db_posts
WHEN NEW.post_revision IS OLD.post_revision AND (
    NEW.title IS NOT OLD.title OR NEW.slug IS NOT OLD.slug OR NEW.excerpt IS NOT OLD.excerpt
    OR NEW.tags IS NOT OLD.tags OR NEW.collaborators IS NOT OLD.collaborators
    OR NEW.published IS NOT OLD.published OR NEW.pinned IS NOT OLD.pinned
    OR NEW.storage_path IS NOT OLD.storage_path OR NEW.banner_path IS NOT OLD.banner_path
    OR NEW.banner_version IS NOT OLD.banner_version
    OR NEW.content_license IS NOT OLD.content_license OR NEW.banner_credit IS NOT OLD.banner_credit
)
BEGIN
    UPDATE db_posts SET post_revision = OLD.post_revision + 1 WHERE id = NEW.id;
END;

CREATE TABLE db_site_settings_next (
    key TEXT PRIMARY KEY CHECK (key IN ('analytics', 'contentLicense')),
    value TEXT NOT NULL CHECK (json_valid(value) AND json_type(value) = 'object' AND length(value) <= 2048),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO db_site_settings_next (key, value, updated_at)
SELECT key, value, updated_at FROM db_site_settings;

DROP TABLE db_site_settings;

ALTER TABLE db_site_settings_next RENAME TO db_site_settings;

CREATE TRIGGER db_site_settings_cache_insert AFTER INSERT ON db_site_settings
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'site';
END;

CREATE TRIGGER db_site_settings_cache_update AFTER UPDATE ON db_site_settings
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'site';
END;

CREATE TRIGGER db_site_settings_cache_delete AFTER DELETE ON db_site_settings
BEGIN
    UPDATE db_cache_generations SET gen = gen + 1 WHERE domain = 'site';
END;
