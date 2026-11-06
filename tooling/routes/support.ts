// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { mock } from 'bun:test';

mock.module('$app/env/public', () => ({
    PUBLIC_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
    PUBLIC_SENTRY_ENVIRONMENT: 'production',
    PUBLIC_CDN_BASE_URL: 'https://cdn.example.com/',
    PUBLIC_API_BASE_URL: 'https://api.example.com'
}));

export const admin = {
    response: null as Response | null,
    authFailure: null as Response | null,
    service: undefined as unknown,
    logged: [] as Array<Record<string, any>>
};

mock.module('../../packages/lib/src/server/adminRequest.ts', () => ({
    requireAdminAuth: async () => admin.authFailure,
    requireSameOriginAdmin: async () => admin.authFailure,
    adminServices: async () =>
        admin.response ? { response: admin.response } : { service: admin.service },
    logAdminActivity: async (_r: Request, _p: unknown, entry: Record<string, any>) =>
        void admin.logged.push(entry)
}));

export const slots = {
    dataStores: ((..._args: unknown[]): any => ({})) as (...args: any[]) => any,
    putBanner: (async (..._args: unknown[]): Promise<unknown> => undefined) as (
        ...args: any[]
    ) => Promise<unknown>,
    cleanupBlogAssets: (async (..._args: unknown[]): Promise<any> => ({
        cleanupPending: false
    })) as (...args: any[]) => Promise<any>,
    checkRateLimit: (async (..._args: unknown[]): Promise<any> => ({
        limited: false,
        headers: {}
    })) as (...args: any[]) => Promise<any>,
    clientIp: ((..._args: unknown[]): string => '203.0.113.9') as (...args: any[]) => string
};

mock.module('../../packages/lib/src/server/data.ts', () => ({
    dataStores: (...args: unknown[]) => slots.dataStores(...args)
}));
mock.module('../../packages/lib/src/server/blogBannerStorage.ts', () => ({
    putBanner: (...args: unknown[]) => slots.putBanner(...args),
    cleanupBlogAssets: (...args: unknown[]) => slots.cleanupBlogAssets(...args)
}));
mock.module('../../packages/lib/src/server/rateLimit.ts', () => ({
    checkRateLimit: (...args: unknown[]) => slots.checkRateLimit(...args),
    clientIp: (...args: unknown[]) => slots.clientIp(...args)
}));

export const sentry = {
    exceptions: [] as unknown[],
    messages: [] as Array<[string, unknown]>,
    configs: [] as Array<Record<string, unknown>>
};

const realSentry = await import('@sentry/cloudflare');

mock.module('@sentry/cloudflare', () => ({
    ...realSentry,
    captureException: (error: unknown) => void sentry.exceptions.push(error),
    captureMessage: (message: string, context: unknown) =>
        void sentry.messages.push([message, context]),
    withSentry: (
        config: (env: Record<string, string>) => Record<string, unknown>,
        handler: unknown
    ) => {
        sentry.configs.push(
            config({}),
            config({ PUBLIC_SENTRY_DSN: 'dsn', PUBLIC_SENTRY_ENVIRONMENT: 'preview' })
        );
        return handler;
    }
}));

export const more = {
    serveIdentityAsset: (async (..._args: unknown[]): Promise<Response> => new Response()) as (
        ...args: any[]
    ) => Promise<Response>,
    cleanupAssets: (async (..._args: unknown[]): Promise<unknown> => undefined) as (
        ...args: any[]
    ) => Promise<unknown>,
    buildPostRender: (async (..._args: unknown[]): Promise<unknown> => ({})) as (
        ...args: any[]
    ) => Promise<unknown>,
    refreshPostRenders: (async (..._args: unknown[]): Promise<any> => ({ failed: 0 })) as (
        ...args: any[]
    ) => Promise<any>
};

mock.module('../../packages/lib/src/server/profileAssets.ts', () => ({
    assetNames: ['avatar.webp', 'banner.webp'],
    serveIdentityAsset: (...args: unknown[]) => more.serveIdentityAsset(...args),
    cleanupAssets: (...args: unknown[]) => more.cleanupAssets(...args),
    removeAssets: (...args: unknown[]) => slot.removeAssets?.(...args),
    removeCanonicalIdentity: (...args: unknown[]) => slot.removeCanonicalIdentity?.(...args)
}));
mock.module('../../packages/lib/src/server/postRender.ts', () => ({
    buildPostRender: (...args: unknown[]) => more.buildPostRender(...args),
    refreshPostRenders: (...args: unknown[]) => more.refreshPostRenders(...args),
    parsePostRender: (...args: unknown[]) => slot.parsePostRender?.(...args)
}));

mock.module('../../packages/lib/src/server/writeFreeze.ts', () => ({
    writeFreezeHandle: (input: any) => input.resolve(input.event),
    writesFrozen: (platform?: { env?: Record<string, unknown> }) =>
        ['1', 'true'].includes(String(platform?.env?.WRITES_FROZEN ?? '').toLowerCase())
}));

export const slot: Record<string, (...args: any[]) => any> = {};

function delegate(file: string, names: string[]) {
    mock.module(`../../packages/lib/src/server/${file}`, () =>
        Object.fromEntries(names.map(name => [name, (...args: unknown[]) => slot[name]?.(...args)]))
    );
}

delegate('publicWrite.ts', ['readPublicWrite']);
delegate('repositories.ts', ['publicRepositories', 'serviceData']);
delegate('workerEnv.ts', ['workerBinding', 'runInBackground']);
delegate('ipSalt.ts', ['ipSalt']);
delegate('moderation.ts', ['moderateContent']);

delegate('adminAuth.ts', ['verifyAdminRequest']);
delegate('accessAuth.ts', ['accessIdentity']);
delegate('adminResume.ts', ['deleteResumeFile']);
delegate('blogPostAssets.ts', [
    'relocateMarkdownAssets',
    'syncPostAssets',
    'movePostBanner',
    'uniqueAssetName'
]);
delegate('blogPostInput.ts', ['parsePostInput', 'boundedBody']);
delegate('validateContentImage.ts', ['validateContentImage', 'validateContentImageAvif']);
delegate('blogContentStorage.ts', ['putContentAsset']);
delegate('postEffects.ts', ['queuePostEffects']);
delegate('subscriberBroadcast.ts', ['notifyNewPost']);
delegate('oidc/admin.ts', ['oidcAdmin']);
delegate('oidc/enabled.ts', ['oidcEnabled']);
delegate('oidc/config.ts', ['oidcEndpoints']);

mock.module('virtual:banner-webp-wasm', () => ({ default: () => 'wasm' }));
mock.module('../../packages/lib/src/cdn.ts', () => ({ cdnBaseUrl: () => 'https://cdn.test' }));

const { blogAdmin: realBlogAdmin } = await import('../../packages/lib/src/server/blogPostAuth.ts');
mock.module('../../packages/lib/src/server/blogPostAuth.ts', () => ({
    blogAdmin: (...args: Parameters<typeof realBlogAdmin>) =>
        slot.blogAdmin ? slot.blogAdmin(...args) : realBlogAdmin(...args)
}));

const realSiteUrl = await import('../../packages/lib/src/server/siteUrl.ts');
const { configuredSiteUrl: realConfiguredSiteUrl, configuredAdminUrl: realConfiguredAdminUrl } =
    realSiteUrl;
mock.module('../../packages/lib/src/server/siteUrl.ts', () => ({
    configuredSiteUrl: (...args: Parameters<typeof realConfiguredSiteUrl>) =>
        slot.configuredSiteUrl ? slot.configuredSiteUrl(...args) : realConfiguredSiteUrl(...args),
    configuredAdminUrl: (...args: Parameters<typeof realConfiguredAdminUrl>) =>
        realConfiguredAdminUrl(...args)
}));

const realAnalytics = await import('../../packages/lib/src/server/analytics.ts');
const { siteAnalytics: realSiteAnalytics, analyticsHead: realAnalyticsHead } = realAnalytics;
const { analyticsSources: realAnalyticsSources, CONSENT_STORAGE_KEY } = realAnalytics;
mock.module('../../packages/lib/src/server/analytics.ts', () => ({
    CONSENT_STORAGE_KEY,
    siteAnalytics: (...args: Parameters<typeof realSiteAnalytics>) =>
        slot.siteAnalytics ? slot.siteAnalytics(...args) : realSiteAnalytics(...args),
    analyticsHead: (...args: Parameters<typeof realAnalyticsHead>) =>
        slot.analyticsHead ? slot.analyticsHead(...args) : realAnalyticsHead(...args),
    analyticsSources: (...args: Parameters<typeof realAnalyticsSources>) =>
        slot.analyticsSources ? slot.analyticsSources(...args) : realAnalyticsSources(...args)
}));

const realMdrs = await import('@mdrs/core');
mock.module('@mdrs/core', () => ({
    ...realMdrs,
    validateDefineForSave: (...args: unknown[]) =>
        slot.validateDefineForSave ?
            slot.validateDefineForSave(...args)
        :   (realMdrs.validateDefineForSave as (...args: unknown[]) => unknown)(...args)
}));
