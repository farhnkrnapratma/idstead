import type { SupabaseClient } from '@supabase/supabase-js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { strToU8, zipSync, type Zippable } from 'fflate';
import {
    fetchAuthorProfile,
    fetchContactInfo,
    fetchCvEntries,
    fetchFundingLinks,
    fetchGroupedSkills,
    fetchSocials
} from '#lib/author.ts';
import { DEFAULT_ADMIN_DISPLAY } from '#lib/adminDateFormat.ts';
import { DEFAULT_CHART_RANGE, parseAdminSettings } from '#lib/adminSettings.ts';
import { assetStorage } from './profileAssets';
import {
    compact,
    createMediaCollector,
    errorMessage,
    nestComments,
    parseStamp,
    safeSegment,
    stripKeys,
    voteFile,
    type CommentRow
} from './dataExportHelpers';

const ACTIVITY_PAGE = 5000;

async function mapLimit<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>) {
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (next < items.length) await task(items[next++]);
        })
    );
}

export async function buildDataExport(
    db: SupabaseClient,
    platform: App.Platform | undefined,
    stampInput: string | null
) {
    const stamp = parseStamp(stampInput);
    const root = `data-export_${stamp}`;
    const files: Zippable = {};
    const warnings: string[] = [];
    const counts: Record<string, number> = {};

    const warn = (scope: string, error: unknown) =>
        warnings.push(`${scope}: ${errorMessage(error)}`);
    const putText = (path: string, text: string) => {
        files[`${root}/${path}`] = strToU8(text);
    };
    const putJson = (path: string, value: unknown) =>
        putText(path, `${JSON.stringify(compact(value), null, 2)}\n`);
    const putBinary = (path: string, bytes: Uint8Array) => {
        files[`${root}/${path}`] = [bytes, { level: 0 }];
        counts.files = (counts.files ?? 0) + 1;
    };

    async function rows<T>(
        scope: string,
        query: PromiseLike<{ data: T[] | null; error: unknown }>
    ) {
        const { data, error } = await query;
        if (error) warn(scope, error);
        return data ?? [];
    }

    async function guard<T>(scope: string, task: () => Promise<T>, fallback: T) {
        try {
            return await task();
        } catch (error) {
            warn(scope, error);
            return fallback;
        }
    }

    let storage: ReturnType<typeof assetStorage> | null = null;
    try {
        storage = assetStorage(platform);
    } catch (error) {
        warn('object storage', error);
    }

    async function readObject(key: string) {
        if (!storage) throw new Error('object storage is not configured');
        const object = await storage.client.send(
            new GetObjectCommand({ Bucket: storage.bucket, Key: key }),
            { abortSignal: AbortSignal.timeout(30_000) }
        );
        const body = await object.Body?.transformToByteArray();
        if (!body) throw new Error('empty object');
        return new Uint8Array(body);
    }

    async function fetchBinary(path: string, key: string, quiet = false) {
        if (!storage) return false;
        try {
            putBinary(path, await readObject(key));
            return true;
        } catch (error) {
            if (!quiet) warn(path, error);
            return false;
        }
    }

    async function readMarkdown(storagePath: string | null) {
        if (!storagePath) return null;
        const { data, error } = await db.storage.from('blog-posts').download(storagePath);
        if (error || !data) throw error ?? new Error('markdown not found');
        return data.text();
    }

    async function writeMedia(dir: string, collector: ReturnType<typeof createMediaCollector>) {
        for (const [key, relative] of collector.files) await fetchBinary(`${dir}/${relative}`, key);
    }

    const [
        posts,
        comments,
        reports,
        feedback,
        legals,
        rules,
        banners,
        documents,
        settingsRows,
        profileRow
    ] = await Promise.all([
        rows<any>(
            'posts',
            db
                .from('db_posts')
                .select(
                    'id, slug, title, excerpt, published, pinned, storage_path, read_time, tags, collaborators, summary, tldr, helpful_yes, helpful_no, created_at, updated_at'
                )
                .order('created_at', { ascending: true })
        ),
        rows<CommentRow & { post_id: string }>(
            'comments',
            db
                .from('db_comments')
                .select(
                    'id, post_id, parent_id, author_name, content, is_anonymous, is_admin, is_approved, created_at'
                )
        ),
        rows<any>(
            'reports',
            db
                .from('db_comment_reports')
                .select('comment_id, reason, details, created_at')
                .order('created_at', { ascending: true })
        ),
        rows<any>(
            'feedback',
            db
                .from('db_feedback_events')
                .select('target_type, target_id, post_id, vote, created_at')
                .order('created_at', { ascending: true })
        ),
        rows<any>(
            'legal pages',
            db.from('db_legals').select('slug, title, content, created_at, updated_at')
        ),
        rows<any>(
            'project rules',
            db
                .from('db_project_repo_rules')
                .select('rule_type, repo_name')
                .order('sort_order', { ascending: true })
        ),
        rows<any>(
            'banners',
            db.from('db_blog_banner_versions').select('post_id, object_key').eq('state', 'active')
        ),
        rows<any>(
            'cv documents',
            db.from('db_documents').select('filename, hash').eq('is_active', true)
        ),
        rows<any>('settings', db.from('db_admin_settings').select('settings')),
        db.from('db_profiles').select('avatar_version').limit(1).maybeSingle()
    ]);

    const postById = new Map<string, { slug: string }>();
    for (const post of posts) postById.set(post.id, { slug: safeSegment(post.slug) });

    const commentsByPost = new Map<string, (CommentRow & { post_id: string })[]>();
    for (const comment of comments) {
        const list = commentsByPost.get(comment.post_id) ?? [];
        list.push(comment);
        commentsByPost.set(comment.post_id, list);
    }
    const commentById = new Map(comments.map(comment => [comment.id, comment]));

    await mapLimit(posts, 4, async post => {
        const slug = postById.get(post.id)!.slug;
        const dir = `content/posts/${slug}`;
        const collector = createMediaCollector();
        await guard(
            `${dir}/${slug}.md`,
            async () => {
                const markdown = await readMarkdown(post.storage_path);
                if (markdown !== null) putText(`${dir}/${slug}.md`, collector.rewrite(markdown));
            },
            undefined
        );
        const banner = banners.find(item => item.post_id === post.id);
        if (banner) {
            await fetchBinary(`${dir}/assets/banner/${slug}.webp`, banner.object_key);
            if (banner.avif_object_key)
                await fetchBinary(`${dir}/assets/banner/${slug}.avif`, banner.avif_object_key);
        }
        await writeMedia(dir, collector);

        const { count, error: viewsError } = await db
            .from('db_views')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', post.id);
        if (viewsError) warn(`${dir}/metadata.json views`, viewsError);

        putJson(`${dir}/metadata.json`, {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            published: post.published,
            pinned: post.pinned,
            tags: post.tags,
            collaborators: post.collaborators,
            summary: post.summary,
            tldr: post.tldr,
            readTime: post.read_time,
            createdAt: post.created_at,
            updatedAt: post.updated_at,
            stats: {
                views: count ?? 0,
                helpfulYes: post.helpful_yes ?? 0,
                helpfulNo: post.helpful_no ?? 0
            }
        });
    });
    counts.posts = posts.length;

    for (const post of posts) {
        const slug = postById.get(post.id)!.slug;
        const dir = `content/posts/${slug}`;
        const postComments = commentsByPost.get(post.id) ?? [];
        if (postComments.length) putJson(`${dir}/comments.json`, nestComments(postComments));
        const postReports = reports.flatMap(report => {
            const comment = commentById.get(report.comment_id);
            if (!comment || comment.post_id !== post.id) return [];
            return [
                {
                    reason: report.reason,
                    details: report.details,
                    createdAt: report.created_at,
                    comment: {
                        author: comment.author_name,
                        content: comment.content,
                        createdAt: comment.created_at
                    }
                }
            ];
        });
        if (postReports.length) putJson(`${dir}/reports.json`, postReports);
        const votes = feedback.filter(
            event => event.target_type === 'article' && event.post_id === post.id
        );
        if (votes.length) putJson(`${dir}/feedback.json`, voteFile(votes));
    }
    counts.comments = comments.length;
    counts.reports = reports.length;

    const legalFeedback = new Map<string, any[]>();
    for (const event of feedback)
        if (event.target_type === 'legal') {
            const list = legalFeedback.get(event.target_id) ?? [];
            list.push(event);
            legalFeedback.set(event.target_id, list);
        }
    for (const [target, events] of legalFeedback)
        putJson(`legal/${safeSegment(target)}/feedback.json`, voteFile(events));

    for (const legal of legals) {
        const slug = safeSegment(legal.slug);
        const dir = `legal/${slug}`;
        const collector = createMediaCollector();
        putText(`${dir}/${slug}.md`, collector.rewrite(legal.content ?? ''));
        putJson(`${dir}/metadata.json`, {
            title: legal.title,
            createdAt: legal.created_at,
            updatedAt: legal.updated_at
        });
        await writeMedia(dir, collector);
    }
    counts.legalPages = legals.length;

    putJson('content/projects.json', {
        pin: rules.filter(r => r.rule_type === 'pin').map(r => r.repo_name),
        exclude: rules.filter(r => r.rule_type === 'exclude').map(r => r.repo_name)
    });

    const profile = await guard(
        'identity/profile.json',
        () => fetchAuthorProfile(db, { includeEmail: true, strict: true }),
        null
    );
    putJson(
        'identity/profile.json',
        stripKeys(profile ?? {}, [
            'id',
            'revision',
            'avatar',
            'avatarVersion',
            'updatedAt',
            'skills',
            'socials',
            'socialLinks',
            'experience',
            'education'
        ])
    );
    const identityIds = ['id', 'sortOrder'];
    putJson(
        'identity/resume.json',
        stripKeys(
            await guard('identity/resume.json', () => fetchCvEntries(db, { strict: true }), {
                experience: [],
                education: []
            }),
            identityIds
        )
    );
    const sections: [
        string,
        (client: SupabaseClient, options: { strict: boolean }) => Promise<unknown>
    ][] = [
        ['skills', fetchGroupedSkills],
        ['socials', fetchSocials],
        ['funding', fetchFundingLinks],
        ['contact', fetchContactInfo]
    ];
    for (const [name, fetcher] of sections)
        putJson(
            `identity/${name}.json`,
            stripKeys(
                await guard(`identity/${name}.json`, () => fetcher(db, { strict: true }), []),
                identityIds
            )
        );

    const avatarVersion = profileRow.data?.avatar_version as string | null;
    if (avatarVersion) {
        const identity = await guard(
            'identity assets',
            async () => {
                const { data, error } = await db
                    .from('db_identity_versions')
                    .select('assets')
                    .eq('id', avatarVersion)
                    .maybeSingle();
                if (error) throw error;
                return (data?.assets ?? []) as { name: string; key: string }[];
            },
            []
        );
        for (const asset of identity)
            await fetchBinary(
                `files/identity/${safeSegment(avatarVersion)}/${safeSegment(asset.name)}`,
                asset.key
            );
    }

    for (const doc of documents) {
        const name = safeSegment(doc.filename);
        await fetchBinary(`files/cv/${name}`, doc.filename);
        const sidecar = `files/cv/${name}.sha256`;
        const fetched = await fetchBinary(sidecar, `${doc.filename}.sha256`, true);
        if (!fetched && doc.hash) putText(sidecar, `${doc.hash}  ${doc.filename}\n`);
    }

    const logs: Record<string, unknown>[] = [];
    await guard(
        'administration/logs.json',
        async () => {
            for (let offset = 0; ; offset += ACTIVITY_PAGE) {
                const { data, error } = await db.rpc('db_activity_log_list', {
                    p_limit: ACTIVITY_PAGE,
                    p_offset: offset
                });
                if (error) throw error;
                const batch = (data?.data ?? []) as any[];
                for (const row of batch)
                    logs.push({
                        timestamp: row.created_at,
                        actor: row.actor,
                        category: row.category,
                        action: row.action,
                        summary: row.summary,
                        details: row.details,
                        ip: row.ip,
                        userAgent: row.user_agent
                    });
                if (batch.length < ACTIVITY_PAGE || logs.length >= data.total) break;
            }
        },
        undefined
    );
    putJson('administration/logs.json', logs);
    const settings = parseAdminSettings(settingsRows[0]?.settings);
    putJson('administration/settings.json', {
        display: { ...DEFAULT_ADMIN_DISPLAY, ...settings.display },
        chartRange: settings.chartRange ?? DEFAULT_CHART_RANGE
    });
    counts.logs = logs.length;

    putJson('manifest.json', {
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        counts,
        warnings
    });

    return { zip: zipSync(files, { level: 6 }), stamp, warnings };
}
