CREATE VIEW db_admin_notification_items AS
SELECT
    n.id,
    n.kind,
    n.post_id,
    n.comment_id,
    n.source_id,
    n.meta,
    n.created_at,
    n.read_at,
    coalesce(json_extract(n.meta, '$.page_type'), CASE WHEN n.post_id IS NOT NULL THEN 'article' END) AS page_type,
    coalesce(json_extract(n.meta, '$.page_id'), n.post_id) AS page_id,
    coalesce(p.title, l.title, json_extract(n.meta, '$.page_title')) AS page_title,
    CASE
        WHEN p.published = 1 AND coalesce(p.slug, '') <> '' THEN '/blog/' || p.slug
        WHEN l.slug IN ('privacy', 'security', 'terms') AND length(trim(l.content)) > 0 THEN '/' || l.slug
    END AS page_url,
    CASE WHEN n.kind = 'comment_report' THEN CASE WHEN r.id IS NULL THEN 'resolved' ELSE 'open' END END AS report_status,
    CASE n.kind
        WHEN 'comment_report' THEN 'Report'
        WHEN 'comment_new' THEN 'Comment'
        WHEN 'contact_message' THEN 'Contact message'
        WHEN 'feedback_report' THEN 'Feedback form'
        ELSE CASE WHEN json_extract(n.meta, '$.vote') = 'yes' THEN 'Helpful' ELSE 'Unhelpful' END
    END AS type_label,
    n.pinned_at
FROM db_admin_notifications n
LEFT JOIN db_posts p ON p.id = n.post_id
LEFT JOIN db_legals l ON n.kind = 'legal_feedback' AND l.slug = json_extract(n.meta, '$.page_id')
LEFT JOIN db_comment_reports r ON n.kind = 'comment_report' AND r.id = n.source_id
WHERE n.dismissed_at IS NULL;

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

CREATE VIEW db_admin_report_items AS
SELECT
    r.id,
    r.reason,
    r.details,
    r.created_at,
    c.id AS comment_id,
    c.post_id,
    c.content,
    CASE WHEN c.is_anonymous = 1 OR c.author_name IS NULL THEN 'Anonymous' ELSE c.author_name END AS author,
    p.title AS page_title,
    CASE WHEN p.published = 1 AND coalesce(p.slug, '') <> '' THEN '/blog/' || p.slug END AS page_url
FROM db_comment_reports r
JOIN db_comments c ON c.id = r.comment_id
JOIN db_posts p ON p.id = c.post_id;
