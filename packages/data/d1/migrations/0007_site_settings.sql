CREATE TABLE db_site_settings (
    key TEXT PRIMARY KEY CHECK (key IN ('analytics')),
    value TEXT NOT NULL CHECK (json_valid(value) AND json_type(value) = 'object' AND length(value) <= 2048),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO db_cache_generations (domain, gen) VALUES ('site', 0);

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

CREATE TABLE db_activity_log_next (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    actor TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('profile', 'resume', 'skills', 'links', 'blog', 'security', 'settings')),
    entity_id TEXT,
    summary TEXT NOT NULL,
    details TEXT CHECK (details IS NULL OR json_valid(details)),
    ip_hash TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    ip TEXT
);

INSERT INTO db_activity_log_next (id, actor, action, category, entity_id, summary, details, ip_hash, user_agent, created_at, ip)
SELECT
    id,
    actor,
    action,
    CASE WHEN category = 'auth' THEN 'security' ELSE category END,
    entity_id,
    summary,
    details,
    ip_hash,
    user_agent,
    created_at,
    ip
FROM db_activity_log;

DROP TABLE db_activity_log;

ALTER TABLE db_activity_log_next RENAME TO db_activity_log;

CREATE INDEX db_activity_log_category_time_id_idx ON db_activity_log (category, created_at DESC, id DESC);
CREATE INDEX db_activity_log_time_id_idx ON db_activity_log (created_at DESC, id DESC);
