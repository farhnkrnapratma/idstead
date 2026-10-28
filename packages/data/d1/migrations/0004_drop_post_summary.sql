DROP TRIGGER db_posts_validate_lists_insert;
DROP TRIGGER db_posts_validate_lists_update;
DROP TRIGGER db_posts_revision;

ALTER TABLE db_posts DROP COLUMN summary;
ALTER TABLE db_posts DROP COLUMN tldr;

CREATE TRIGGER db_posts_validate_lists_insert BEFORE INSERT ON db_posts
WHEN EXISTS (SELECT 1 FROM json_each(coalesce(NEW.tags, '[]')) WHERE type <> 'text' OR length(value) > 30)
BEGIN
    SELECT RAISE(ABORT, 'Tags allow at most 30 characters');
END;

CREATE TRIGGER db_posts_validate_lists_update BEFORE UPDATE OF tags ON db_posts
WHEN EXISTS (SELECT 1 FROM json_each(coalesce(NEW.tags, '[]')) WHERE type <> 'text' OR length(value) > 30)
BEGIN
    SELECT RAISE(ABORT, 'Tags allow at most 30 characters');
END;

CREATE TRIGGER db_posts_revision AFTER UPDATE ON db_posts
WHEN NEW.post_revision IS OLD.post_revision AND (
    NEW.title IS NOT OLD.title OR NEW.slug IS NOT OLD.slug OR NEW.excerpt IS NOT OLD.excerpt
    OR NEW.tags IS NOT OLD.tags OR NEW.collaborators IS NOT OLD.collaborators
    OR NEW.published IS NOT OLD.published OR NEW.pinned IS NOT OLD.pinned
    OR NEW.storage_path IS NOT OLD.storage_path OR NEW.banner_path IS NOT OLD.banner_path
    OR NEW.banner_version IS NOT OLD.banner_version
)
BEGIN
    UPDATE db_posts SET post_revision = OLD.post_revision + 1 WHERE id = NEW.id;
END;
