import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostAssetState } from '../adminPosts';
import type {
    DeletionPlan,
    ExportFailure,
    ExportRow,
    ExportTables,
    SiteDataStore
} from '../siteData';
import { DataError } from '../errors';

type Query = PromiseLike<{ data: unknown; error: unknown }>;

export function createSupabaseSiteDataStore(db: SupabaseClient): SiteDataStore {
    return {
        async exportTables() {
            const failures: ExportFailure[] = [];
            const rows = async (scope: string, query: Query) => {
                const { data, error } = await query;
                if (error) failures.push({ scope, error });
                return (data ?? []) as ExportRow[];
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
                profiles
            ] = await Promise.all([
                rows(
                    'posts',
                    db
                        .from('db_posts')
                        .select(
                            'id, slug, title, excerpt, published, pinned, storage_path, read_time, tags, collaborators, summary, tldr, helpful_yes, helpful_no, view_count, created_at, updated_at'
                        )
                        .order('created_at', { ascending: true })
                ),
                rows(
                    'comments',
                    db
                        .from('db_comments')
                        .select(
                            'id, post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved, created_at'
                        )
                ),
                rows(
                    'reports',
                    db
                        .from('db_comment_reports')
                        .select('comment_id, reason, details, created_at')
                        .order('created_at', { ascending: true })
                ),
                rows(
                    'feedback',
                    db
                        .from('db_feedback_events')
                        .select('target_type, target_id, post_id, vote, created_at')
                        .order('created_at', { ascending: true })
                ),
                rows(
                    'legal pages',
                    db.from('db_legals').select('slug, title, content, created_at, updated_at')
                ),
                rows(
                    'project rules',
                    db
                        .from('db_project_repo_rules')
                        .select('rule_type, repo_name')
                        .order('sort_order', { ascending: true })
                ),
                rows(
                    'cv documents',
                    db.from('db_documents').select('filename, hash').eq('is_active', true)
                ),
                rows('settings', db.from('db_admin_settings').select('settings')),
                rows('profile', db.from('db_profiles').select('avatar_version').limit(1))
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
                avatarVersion: (profiles[0]?.avatar_version as string | null | undefined) ?? null
            };
            return { tables, failures };
        },

        async postMarkdown(storagePath: string) {
            const { data, error } = await db.storage.from('blog-posts').download(storagePath);
            if (error || !data) throw new DataError('siteData.postMarkdown', error);
            return data.text();
        },

        async deletionPlan(): Promise<DeletionPlan> {
            const { data: profile, error: profileError } = await db
                .from('db_profiles')
                .select('id')
                .limit(1)
                .maybeSingle();
            if (profileError) throw new DataError('siteData.deletionPlan.profile', profileError);
            let documents: string[] = [];
            let identityVersions: string[] = [];
            if (profile?.id) {
                const [documentRows, versionRows] = await Promise.all([
                    db.from('db_documents').select('filename').eq('author_id', profile.id),
                    db.from('db_identity_versions').select('id').eq('profile_id', profile.id)
                ]);
                const error = documentRows.error || versionRows.error;
                if (error) throw new DataError('siteData.deletionPlan.files', error);
                documents = ((documentRows.data ?? []) as ExportRow[])
                    .map(row => row.filename as string)
                    .filter(Boolean);
                identityVersions = ((versionRows.data ?? []) as ExportRow[]).map(
                    row => row.id as string
                );
            }
            const { data: posts, error: postError } = await db
                .from('db_posts')
                .select('id, slug, published, banner_version');
            if (postError) throw new DataError('siteData.deletionPlan.posts', postError);
            return {
                documents,
                identityVersions,
                posts: ((posts ?? []) as ExportRow[]).map(
                    row =>
                        ({
                            id: row.id,
                            slug: row.slug,
                            published: Boolean(row.published),
                            banner_version: row.banner_version ?? null
                        }) satisfies PostAssetState
                )
            };
        },

        async clearAll() {
            const { error } = await db.rpc('db_clear_all_data');
            if (error) throw new DataError('siteData.clearAll', error);
        }
    };
}
