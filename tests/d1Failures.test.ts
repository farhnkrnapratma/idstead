// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import type { ContentBucket, D1Like, D1Statement } from '../packages/data/src/d1/client.ts';
import * as activity from '../packages/data/src/d1/activity.ts';
import * as adminActivity from '../packages/data/src/d1/adminActivity.ts';
import * as adminAuthor from '../packages/data/src/d1/adminAuthor.ts';
import * as adminPosts from '../packages/data/src/d1/adminPosts.ts';
import * as author from '../packages/data/src/d1/author.ts';
import * as blog from '../packages/data/src/d1/blog.ts';
import * as legal from '../packages/data/src/d1/legal.ts';
import * as oidc from '../packages/data/src/d1/oidc.ts';
import * as resumeDocuments from '../packages/data/src/d1/resumeDocuments.ts';
import * as siteData from '../packages/data/src/d1/siteData.ts';
import * as siteSettings from '../packages/data/src/d1/siteSettings.ts';
import * as subscribers from '../packages/data/src/d1/subscribers.ts';
import * as support from '../packages/data/src/d1/support.ts';
import * as writes from '../packages/data/src/d1/writes.ts';
import { createD1CacheGenerations } from '../packages/data/src/cache/index.ts';
import { DataError } from '../packages/data/src/errors.ts';

const down = () => Promise.reject(new Error('database offline'));

const statement: D1Statement = {
    bind: () => statement,
    first: down,
    all: down,
    run: down
} as unknown as D1Statement;

const failingDb: D1Like = { prepare: () => statement, batch: down };

const failingBucket: ContentBucket = {
    get: down,
    put: down,
    delete: down,
    list: down
} as unknown as ContentBucket;

const argumentSets: unknown[][] = [
    [],
    ['id', 'id', 'id'],
    [{}, {}, {}],
    [1, 2, 3],
    [['id'], ['id']],
    [{ id: 'id', slug: 's', postId: 'id', limit: 1, offset: 0 }]
];

async function settle(call: () => unknown): Promise<unknown> {
    try {
        return await call();
    } catch (error) {
        return error;
    }
}

async function drive(store: unknown): Promise<unknown[]> {
    const outcomes: unknown[] = [];
    for (const member of Object.values(store as Record<string, unknown>)) {
        if (typeof member !== 'function') continue;
        for (const args of argumentSets) {
            outcomes.push(await settle(() => (member as (...a: unknown[]) => unknown)(...args)));
        }
    }
    return outcomes;
}

const factories: Record<string, () => unknown> = {
    feedbackRecorder: () => activity.createD1FeedbackRecorder(failingDb),
    adminNotifier: () => activity.createD1AdminNotifier(failingDb),
    activityLog: () => activity.createD1ActivityLog(failingDb),
    adminSettings: () => activity.createD1AdminSettingsStore(failingDb),
    adminActivity: () => adminActivity.createD1AdminActivityStore(failingDb),
    adminAuthor: () =>
        (adminAuthor.createD1AdminAuthorStore as (...a: unknown[]) => unknown)(
            failingDb,
            failingBucket
        ),
    authorWriter: () => adminAuthor.createD1AuthorWriter(failingDb),
    adminPosts: () => adminPosts.createD1AdminPostStore(failingDb, failingBucket),
    postOperations: () => adminPosts.createD1PostOperationStore(failingDb, failingBucket),
    postCleanup: () => adminPosts.createD1PostCleanupStore(failingDb, failingBucket),
    authorReader: () =>
        (author.createD1AuthorReader as (...a: unknown[]) => unknown)(failingDb, failingBucket),
    authorRepository: () =>
        (author.createD1AuthorRepository as (...a: unknown[]) => unknown)(failingDb, failingBucket),
    blog: () =>
        (blog.createD1BlogRepository as (...a: unknown[]) => unknown)(failingDb, failingBucket),
    comments: () => blog.createD1CommentRepository(failingDb),
    renders: () => blog.createD1RenderStore(failingDb, failingBucket),
    legalReader: () => legal.createD1LegalPageRepository(failingDb),
    legalWriter: () => legal.createD1LegalPageWriter(failingDb),
    oidcClients: () => oidc.createD1OidcClientStore(failingDb),
    oidcAuth: () => oidc.createD1OidcAuthStore(failingDb),
    resumeDocuments: () => resumeDocuments.createD1ResumeDocumentStore(failingDb),
    openPgpKeys: () => resumeDocuments.createD1OpenPgpKeyStore(failingDb),
    siteData: () => siteData.createD1SiteDataStore(failingDb, failingBucket),
    siteSettingsReader: () => siteSettings.createD1SiteSettingsRepository(failingDb),
    siteSettingsWriter: () => siteSettings.createD1SiteSettingsWriter(failingDb),
    subscribers: () => subscribers.createD1SubscriberRepository(failingDb),
    newsletter: () => subscribers.createD1NewsletterStore(failingDb),
    identityVersions: () => support.createD1IdentityVersionReader(failingDb),
    ardIndex: () => support.createD1ArdIndexStore(failingDb),
    lockout: () => support.createD1LockoutStore(failingDb),
    maintenance: () => support.createD1MaintenanceStore(failingDb),
    commentWriter: () => writes.createD1CommentWriter(failingDb),
    viewRecorder: () => writes.createD1ViewRecorder(failingDb),
    cacheGenerations: () => createD1CacheGenerations(failingDb)
};

const rawErrors = new Set(['postOperations', 'cacheGenerations']);

describe('D1 repositories when the database is offline', () => {
    for (const [name, factory] of Object.entries(factories)) {
        if (rawErrors.has(name)) continue;
        test(`${name} never leaks a raw database error`, async () => {
            const outcomes = await drive(factory());
            expect(outcomes.length).toBeGreaterThan(0);
            const leaked = outcomes.filter(
                outcome =>
                    outcome instanceof Error
                    && !(outcome instanceof DataError)
                    && outcome.message === 'database offline'
            );
            expect(leaked).toEqual([]);
        });
    }
});
