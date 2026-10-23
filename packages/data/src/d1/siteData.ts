import type {
    DeletionPlan,
    ExportFailure,
    ExportRow,
    ExportTables,
    SiteDataStore
} from '../siteData';
import { DataError } from '../errors';
import { flag, jsonStrings, readContent, type ContentBucket, type D1Like } from './client';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

function parseJson(value: unknown): unknown {
    if (typeof value !== 'string') return value ?? null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function createD1SiteDataStore(db: D1Like, bucket: ContentBucket): SiteDataStore {
    return {
        async exportTables() {
            const failures: ExportFailure[] = [];
            const rows = async (
                scope: string,
                sql: string,
                map: (row: ExportRow) => ExportRow = row => row
            ) => {
                try {
                    return (await db.prepare(sql).all<ExportRow>()).results.map(map);
                } catch (error) {
                    failures.push({ scope, error });
                    return [];
                }
            };
            const [
                posts,
                comments,
                reports,
                feedback,
                legals,
                repoRules,
                activeDocuments,
                settings,
                subscribers,
                profiles
            ] = await Promise.all([
                rows(
                    'posts',
                    `SELECT p.id, p.slug, p.title, p.excerpt, p.published, p.pinned, p.storage_path, p.read_time, p.tags, p.collaborators,
                             p.summary, p.tldr, coalesce(s.helpful_yes, 0) AS helpful_yes, coalesce(s.helpful_no, 0) AS helpful_no,
                             coalesce(s.view_count, 0) AS view_count, p.created_at, p.updated_at
                         FROM db_posts p LEFT JOIN db_post_stats s ON s.post_id = p.id ORDER BY p.created_at`,
                    row => ({
                        ...row,
                        published: flag(row.published),
                        pinned: flag(row.pinned),
                        tags: row.tags === null ? null : jsonStrings(row.tags),
                        collaborators:
                            row.collaborators === null ? null : jsonStrings(row.collaborators),
                        tldr: row.tldr === null ? null : jsonStrings(row.tldr)
                    })
                ),
                rows(
                    'comments',
                    'SELECT id, post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved, created_at FROM db_comments',
                    row => ({
                        ...row,
                        is_anonymous: flag(row.is_anonymous),
                        is_admin: flag(row.is_admin),
                        is_approved: flag(row.is_approved)
                    })
                ),
                rows(
                    'reports',
                    'SELECT comment_id, reason, details, created_at FROM db_comment_reports ORDER BY created_at'
                ),
                rows(
                    'feedback',
                    'SELECT target_type, target_id, post_id, vote, created_at FROM db_feedback_events ORDER BY created_at'
                ),
                rows(
                    'legal pages',
                    'SELECT slug, title, content, created_at, updated_at FROM db_legals'
                ),
                rows(
                    'project rules',
                    'SELECT rule_type, repo_name FROM db_project_repo_rules ORDER BY sort_order'
                ),
                rows('cv documents', 'SELECT filename, hash FROM db_documents WHERE is_active = 1'),
                rows('settings', 'SELECT settings FROM db_admin_settings', row => ({
                    settings: parseJson(row.settings)
                })),
                rows(
                    'subscribers',
                    'SELECT email, status, confirmed_at, unsubscribed_at, created_at FROM db_subscribers ORDER BY created_at'
                ),
                rows('profile', 'SELECT avatar_version FROM db_profiles LIMIT 1')
            ]);
            const tables: ExportTables = {
                posts,
                comments,
                reports,
                feedback,
                legals,
                repoRules,
                activeDocuments,
                settings,
                subscribers,
                avatarVersion: (profiles[0]?.avatar_version as string | null | undefined) ?? null
            };
            return { tables, failures };
        },

        async postMarkdown(storagePath: string) {
            const markdown = await readContent(bucket, storagePath);
            if (markdown === null)
                throw new DataError('siteData.postMarkdown', 'The markdown file is missing.');
            return markdown;
        },

        async deletionPlan(): Promise<DeletionPlan> {
            try {
                const profile = await db
                    .prepare('SELECT id FROM db_profiles LIMIT 1')
                    .first<{ id: string }>();
                const [documents, versions, posts] = await db.batch([
                    db
                        .prepare('SELECT filename FROM db_documents WHERE author_id = ?1')
                        .bind(profile?.id ?? null),
                    db
                        .prepare('SELECT id FROM db_identity_versions WHERE profile_id = ?1')
                        .bind(profile?.id ?? null),
                    db.prepare('SELECT id, slug, published, banner_version FROM db_posts')
                ]);
                return {
                    documents: documents.results.map(row => String(row.filename)).filter(Boolean),
                    identityVersions: versions.results.map(row => String(row.id)),
                    posts: posts.results.map(row => ({
                        id: String(row.id),
                        slug: String(row.slug),
                        published: flag(row.published),
                        banner_version:
                            typeof row.banner_version === 'string' ? row.banner_version : null
                    }))
                };
            } catch (error) {
                throw new DataError('siteData.deletionPlan', error);
            }
        },

        async clearAll() {
            try {
                await db.batch(
                    [
                        'DELETE FROM db_admin_notifications',
                        'DELETE FROM db_feedback_operations',
                        'DELETE FROM db_feedback_events',
                        'DELETE FROM db_comment_reports',
                        'DELETE FROM db_comments',
                        'DELETE FROM db_views',
                        'DELETE FROM db_post_feedback',
                        'DELETE FROM db_blog_banner_references',
                        `INSERT INTO db_post_storage_cleanup (storage_path, post_id)
                         SELECT storage_path, id FROM db_posts WHERE storage_path IS NOT NULL ON CONFLICT DO NOTHING`,
                        'DELETE FROM db_post_operations',
                        'DELETE FROM db_posts',
                        'DELETE FROM db_blog_banner_versions',
                        'DELETE FROM db_project_repo_rules',
                        'DELETE FROM db_legals',
                        'DELETE FROM db_activity_log',
                        'DELETE FROM db_experiences',
                        'DELETE FROM db_educations',
                        'DELETE FROM db_links',
                        'DELETE FROM db_categories',
                        'UPDATE db_documents SET is_active = 0',
                        `UPDATE db_identity_versions SET retired_at = coalesce(retired_at, ${NOW}) WHERE profile_id IS NOT NULL`,
                        `UPDATE db_profiles SET name = '', username = '', headline = '', job_title = '', bio = '', email = '', city = '',
                             postal_code = '', country = '', site_url = '', pronunciation = NULL, avatar = '', avatar_version = NULL,
                             banner_version = NULL`
                    ].map(sql => db.prepare(sql))
                );
            } catch (error) {
                throw new DataError('siteData.clearAll', error);
            }
        }
    };
}
