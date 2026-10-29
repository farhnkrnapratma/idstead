CREATE TABLE db_activity_log_next (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    actor TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('profile', 'resume', 'skills', 'links', 'blog', 'auth', 'security')),
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
    CASE WHEN action LIKE 'cv.%' THEN 'resume.' || substr(action, 4) ELSE action END,
    CASE WHEN category = 'cv' THEN 'resume' ELSE category END,
    entity_id,
    CASE WHEN category = 'cv' THEN replace(summary, 'CV', 'resume') ELSE summary END,
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

UPDATE db_documents SET file_url = replace(file_url, '/cv/', '/resume/') WHERE file_url LIKE '%/cv/%';

DROP INDEX idx_cv_documents_author_id;
CREATE INDEX idx_resume_documents_author_id ON db_documents (author_id);
