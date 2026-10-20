import type { SupabaseClient } from '@supabase/supabase-js';
import { strToU8, zipSync, type Zippable } from 'fflate';
import {
    createSupabaseActivityLog,
    createSupabaseAdminAuthorStore,
    createSupabaseSiteDataStore
} from '@idstead/data';
import { skillGroupFromItem } from '@idstead/domain/author.ts';
import { DEFAULT_ADMIN_DISPLAY } from '#lib/adminDateFormat.ts';
import { DEFAULT_CHART_RANGE, parseAdminSettings } from '#lib/adminSettings.ts';
import { findAssetBucket, readObjectBytes } from './r2';
import { postAssetHome } from '#lib/blogBanner.ts';
import { cdnBaseUrl } from '#lib/cdn.ts';
import { listKeys } from './blogPostAssets';
import { identityAssetNames } from '#lib/siteIdentity.ts';
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

    const siteData = createSupabaseSiteDataStore(db);

    async function guard<T>(scope: string, task: () => Promise<T>, fallback: T) {
        try {
            return await task();
        } catch (error) {
            warn(scope, error);
            return fallback;
        }
    }

    const storage = await findAssetBucket(platform);
    if (!storage) warn('object storage', new Error('object storage is not configured'));

    async function readObject(key: string) {
        if (!storage) throw new Error('object storage is not configured');
        const body = await readObjectBytes(storage, key);
        if (!body) throw new Error('empty object');
        return body;
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
        return siteData.postMarkdown(storagePath);
    }

    async function writeMedia(dir: string, collector: ReturnType<typeof createMediaCollector>) {
        for (const [key, relative] of collector.files) await fetchBinary(`${dir}/${relative}`, key);
    }

    const { tables, failures } = await siteData.exportTables();
    for (const failure of failures) warn(failure.scope, failure.error);
    const posts = tables.posts as any[];
    const reports = tables.reports as any[];
    const feedback = tables.feedback as any[];
    const legals = tables.legals as any[];
    const rules = tables.repoRules as any[];
    const documents = tables.activeDocuments;
    const settingsRows = tables.settings;
    const { avatarVersion } = tables;
    const comments = tables.comments as (CommentRow & { post_id: string })[];

    const cdnBase = cdnBaseUrl();
    const postById = new Map<string, { slug: string; dir: string }>();
    for (const post of posts)
        postById.set(post.id, { slug: safeSegment(post.slug), dir: postAssetHome(post) });

    const commentsByPost = new Map<string, (CommentRow & { post_id: string })[]>();
    for (const comment of comments) {
        const list = commentsByPost.get(comment.post_id) ?? [];
        list.push(comment);
        commentsByPost.set(comment.post_id, list);
    }
    const commentById = new Map(comments.map(comment => [comment.id, comment]));

    await mapLimit(posts, 4, async post => {
        const { slug, dir } = postById.get(post.id)!;
        await guard(
            `${dir}/${slug}.md`,
            async () => {
                const markdown = await readMarkdown(post.storage_path);
                if (markdown !== null)
                    putText(`${dir}/${slug}.md`, markdown.split(`${cdnBase}/${dir}/`).join(''));
            },
            undefined
        );
        if (storage)
            for (const { key } of await guard(
                `${dir} assets`,
                () => listKeys(platform, `${dir}/`),
                []
            ))
                await fetchBinary(key, key);

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
                views: post.view_count ?? 0,
                helpfulYes: post.helpful_yes ?? 0,
                helpfulNo: post.helpful_no ?? 0
            }
        });
    });
    counts.posts = posts.length;

    for (const post of posts) {
        const { dir } = postById.get(post.id)!;
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

    const author = await guard(
        'identity',
        () => createSupabaseAdminAuthorStore(db).snapshot(),
        null
    );
    putJson(
        'identity/profile.json',
        stripKeys(author?.profile ?? {}, [
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
        stripKeys(author?.cv ?? { experience: [], education: [] }, identityIds)
    );
    const sections: [string, unknown[]][] = [
        ['skills', (author?.skills ?? []).map(skillGroupFromItem)],
        ['socials', author?.social ?? []],
        ['funding', author?.funding ?? []],
        ['contact', author?.contact ?? []]
    ];
    for (const [name, items] of sections)
        putJson(`identity/${name}.json`, stripKeys(items, identityIds));

    if (avatarVersion)
        for (const name of identityAssetNames)
            if (!(await fetchBinary(`identity/${name}`, `identity/${name}`, true)))
                await fetchBinary(
                    `identity/${name}`,
                    `identity/${safeSegment(avatarVersion)}/${name}`
                );

    if (storage && documents.length)
        for (const { key } of await guard('cv files', () => listKeys(platform, 'cv/'), []))
            await fetchBinary(key, key);

    const logs: Record<string, unknown>[] = [];
    const activityLog = createSupabaseActivityLog(db);
    await guard(
        'administration/logs.json',
        async () => {
            for (let offset = 0; ; offset += ACTIVITY_PAGE) {
                const data = await activityLog.list({
                    category: null,
                    query: null,
                    direction: 'desc',
                    sort: 'created_at',
                    from: null,
                    to: null,
                    limit: ACTIVITY_PAGE,
                    offset
                });
                const batch = data.data as any[];
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
