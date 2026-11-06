// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { strFromU8, unzipSync } from 'fflate';

mock.module('$app/env/public', () => ({ PUBLIC_CDN_BASE_URL: 'https://cdn.test/' }));

const { buildDataExport } = await import('../packages/lib/src/server/dataExport.ts');

const POST_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const DRAFT_ID = '7c9e6679-7425-40de-944b-e07fc1f90001';

function bucket(objects: Record<string, string>, missing: string[] = []) {
    return {
        head: async () => null,
        get: async (key: string) => {
            if (missing.includes(key)) return null;
            if (!(key in objects)) return null;
            return { arrayBuffer: async () => new TextEncoder().encode(objects[key]).buffer };
        },
        put: async () => null,
        delete: async () => {},
        list: async ({ prefix }: { prefix?: string }) => ({
            objects: Object.keys(objects)
                .filter(key => key.startsWith(prefix ?? ''))
                .map(key => ({ key, uploaded: new Date(0) })),
            truncated: false
        })
    };
}

const tables = {
    posts: [
        {
            id: POST_ID,
            slug: 'hello',
            published: true,
            title: 'Hello',
            storage_path: 'posts/p/hello.md',
            tags: ['a'],
            collaborators: [],
            view_count: 3
        },
        { id: DRAFT_ID, slug: 'draft', published: false, title: 'Draft', storage_path: null }
    ],
    comments: [
        {
            id: 'c1',
            post_id: POST_ID,
            parent_id: null,
            author_name: 'A',
            content: 'x',
            created_at: '2026-10-01T00:00:00Z'
        },
        {
            id: 'c2',
            post_id: POST_ID,
            parent_id: 'c1',
            author_name: 'B',
            content: 'y',
            created_at: '2026-10-02T00:00:00Z'
        }
    ],
    reports: [
        { comment_id: 'c1', reason: 'spam', details: null, created_at: '2026-10-03T00:00:00Z' },
        { comment_id: 'nope', reason: 'spam', details: null, created_at: 't' }
    ],
    feedback: [
        { target_type: 'article', post_id: POST_ID, vote: 'yes', created_at: 't' },
        { target_type: 'legal', target_id: 'privacy', vote: 'no', created_at: 't' }
    ],
    legals: [
        {
            slug: 'privacy',
            title: 'Privacy',
            content: 'text ![a](https://cdn.test/legal/privacy/a.png)',
            created_at: 't',
            updated_at: 't'
        }
    ],
    repoRules: [
        { rule_type: 'pin', repo_name: 'r1' },
        { rule_type: 'exclude', repo_name: 'r2' }
    ],
    activeDocuments: [{ id: 'd' }],
    settings: [{ settings: '{"chartRange":"30d"}' }],
    siteSettings: [{ key: 'analytics', value: '{}' }],
    subscribers: [{ email: 'a@b.co', status: 'confirmed', created_at: 't' }],
    avatarVersion: 'v1'
};

function stores(
    overrides: {
        tables?: unknown;
        failures?: unknown[];
        snapshotFails?: boolean;
        logsFail?: boolean;
        logs?: number;
    } = {}
) {
    const rows = Array.from({ length: overrides.logs ?? 2 }, (_, index) => ({
        created_at: `t${index}`,
        actor: 'me',
        category: 'c',
        action: 'a',
        summary: 's',
        details: null,
        ip: null,
        user_agent: null
    }));
    return {
        siteData: {
            exportTables: async () => ({
                tables: overrides.tables ?? tables,
                failures: overrides.failures ?? []
            }),
            postMarkdown: async (path: string) => (path.includes('missing') ? null : 'plain body')
        },
        adminAuthor: {
            snapshot: async () => {
                if (overrides.snapshotFails) throw new Error('identity down');
                return {
                    profile: { id: 'x', name: 'Ada', bio: 'b' },
                    resume: { experience: [{ id: 'e', title: 't' }], education: [] },
                    skills: [{ id: 's', category: 'c', skills: ['a'] }],
                    social: [{ id: 'so', platform: 'p' }],
                    funding: [],
                    contact: [{ id: 'co', platform: 'email' }]
                };
            }
        },
        activityLog: {
            list: async () => {
                if (overrides.logsFail) throw new Error('logs down');
                return { data: rows, total: rows.length };
            }
        }
    } as never;
}

const platform = (objects: Record<string, string>) =>
    ({ env: { ASSET_BUCKET: bucket(objects) } }) as never;

function unpack(zip: Uint8Array) {
    const entries = unzipSync(zip);
    return Object.fromEntries(
        Object.entries(entries).map(([name, bytes]) => [
            name.replace(/^data-export_[^/]+\//, ''),
            strFromU8(bytes)
        ])
    );
}

describe('buildDataExport', () => {
    beforeEach(() => {
        mock.module('$app/env/public', () => ({ PUBLIC_CDN_BASE_URL: 'https://cdn.test/' }));
    });

    test('writes posts, comments, legal pages, identity, logs and a manifest', async () => {
        const objects = {
            'blog/hello/pic.png': 'PNG',
            'identity/avatar-64.webp': 'AV',
            'identity/v1/avatar-128.webp': 'AV2',
            'resume/resume.pdf': 'PDF',
            'legal/privacy/a.png': 'IMG'
        };
        const { zip, stamp, warnings } = await buildDataExport(
            stores(),
            platform(objects),
            '20261001-083926'
        );
        expect(stamp).toBe('20261001-083926');
        const files = unpack(zip);
        expect(files['blog/hello/hello.md']).toBe('plain body');
        expect(files['blog/hello/pic.png']).toBe('PNG');
        expect(JSON.parse(files['blog/hello/metadata.json'])).toMatchObject({
            title: 'Hello',
            stats: { views: 3 }
        });
        expect(JSON.parse(files['blog/hello/comments.json'])).toHaveLength(1);
        expect(JSON.parse(files['blog/hello/reports.json'])).toHaveLength(1);
        expect(JSON.parse(files['blog/hello/feedback.json']).totals.yes).toBe(1);
        expect(JSON.parse(files['legal/privacy/feedback.json']).totals.no).toBe(1);
        expect(files['legal/privacy/privacy.md']).toContain('text');
        expect(JSON.parse(files['content/projects.json'])).toEqual({
            pin: ['r1'],
            exclude: ['r2']
        });
        expect(JSON.parse(files['identity/profile.json'])).toEqual({ name: 'Ada', bio: 'b' });
        expect(files['identity/skills.json']).toContain('category');
        expect(files['resume/resume.pdf']).toBe('PDF');
        expect(JSON.parse(files['administration/logs.json'])).toHaveLength(2);
        expect(JSON.parse(files['administration/settings.json']).chartRange).toBe('30d');
        expect(JSON.parse(files['administration/subscribers.json'])[0].email).toBe('a@b.co');
        expect(JSON.parse(files['manifest.json'])).toMatchObject({
            formatVersion: 1,
            counts: { posts: 2, comments: 2, subscribers: 1 }
        });
        expect(warnings.length).toBeGreaterThan(0);
    });

    test('keeps going and records warnings when storage and stores fail', async () => {
        const broken = {
            ...tables,
            avatarVersion: null,
            activeDocuments: [],
            settings: [],
            posts: [{ ...tables.posts[0], storage_path: 'posts/missing.md' }]
        };
        const { zip, warnings } = await buildDataExport(
            stores({
                tables: broken,
                failures: [{ scope: 'reports', error: new Error('no table') }],
                snapshotFails: true,
                logsFail: true
            }),
            undefined,
            '../bad'
        );
        const files = unpack(zip);
        expect(warnings.join('\n')).toContain('object storage: object storage is not configured');
        expect(warnings.join('\n')).toContain('reports: no table');
        expect(warnings.join('\n')).toContain('identity: identity down');
        expect(warnings.join('\n')).toContain('administration/logs.json: logs down');
        expect(files['blog/hello/hello.md']).toBeUndefined();
        expect(JSON.parse(files['identity/profile.json'])).toEqual({});
        expect(JSON.parse(files['administration/settings.json']).chartRange).toBeDefined();
    });

    test('pages through long activity logs', async () => {
        const { zip } = await buildDataExport(stores({ logs: 5000 }), platform({}), null);
        const files = unpack(zip);
        expect(JSON.parse(files['administration/logs.json']).length).toBe(5000);
    });

    test('warns about unreadable objects without failing', async () => {
        const objects = { 'blog/hello/pic.png': '' };
        const { warnings } = await buildDataExport(stores(), platform(objects), null);
        expect(warnings.some(warning => warning.includes('empty object'))).toBe(true);
    });
});
