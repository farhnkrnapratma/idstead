DROP TRIGGER db_post_feedback_event;
DROP TABLE db_post_feedback;

DROP VIEW db_admin_feedback_items;
DROP TRIGGER db_feedback_events_notify;

CREATE TABLE db_feedback_event_links AS
SELECT operation_id, event_id FROM db_feedback_operations WHERE event_id IS NOT NULL;

CREATE TABLE db_feedback_events_next (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
    target_type TEXT NOT NULL CHECK (target_type IN ('article', 'legal')),
    target_id TEXT NOT NULL,
    post_id TEXT REFERENCES db_posts (id) ON DELETE CASCADE,
    page_title TEXT NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
    ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO db_feedback_events_next (id, target_type, target_id, post_id, page_title, vote, ip_hash, created_at)
SELECT id, target_type, target_id, post_id, page_title, vote, ip_hash, created_at FROM db_feedback_events;

DROP TABLE db_feedback_events;
ALTER TABLE db_feedback_events_next RENAME TO db_feedback_events;

UPDATE db_feedback_operations
SET event_id = (
    SELECT l.event_id FROM db_feedback_event_links l
    WHERE l.operation_id = db_feedback_operations.operation_id
)
WHERE operation_id IN (SELECT operation_id FROM db_feedback_event_links);

DROP TABLE db_feedback_event_links;

CREATE INDEX db_feedback_created_page_idx ON db_feedback_events (created_at DESC, id DESC);
CREATE INDEX db_feedback_events_page_idx ON db_feedback_events (target_type, target_id, created_at DESC, id DESC);
CREATE INDEX db_feedback_events_post_id_idx ON db_feedback_events (post_id);
CREATE INDEX db_feedback_events_quota_idx ON db_feedback_events (target_type, target_id, ip_hash, created_at DESC);

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

CREATE VIEW db_admin_feedback_items AS
SELECT
    f.id,
    f.target_type,
    f.target_id,
    f.vote,
    f.created_at,
    coalesce(p.title, l.title, f.page_title) AS page_title,
    CASE
        WHEN p.published = 1 AND coalesce(p.slug, '') <> '' THEN '/blog/' || p.slug
        WHEN l.slug IN ('privacy', 'security', 'terms') AND length(trim(l.content)) > 0 THEN '/' || l.slug
    END AS page_url
FROM db_feedback_events f
LEFT JOIN db_posts p ON p.id = f.post_id
LEFT JOIN db_legals l ON f.target_type = 'legal' AND l.slug = f.target_id;
