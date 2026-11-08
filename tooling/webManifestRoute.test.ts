// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('$app/env/public', () => ({
    PUBLIC_API_BASE_URL: 'https://api.example.com',
    PUBLIC_CDN_BASE_URL: 'https://cdn.example.com/'
}));

const state = { profile: null as Record<string, unknown> | null };
mock.module('../packages/lib/src/server/repositories.ts', () => ({
    publicRepositories: () => ({ author: { profile: async () => state.profile } })
}));

const manifest = (await import('../apps/web/src/routes/site.webmanifest/+server.ts')) as {
    GET: (event: unknown) => Promise<Response>;
};

const event = {
    request: new Request('https://example.com/site.webmanifest'),
    platform: { env: { PUBLIC_SITE_URL: 'https://example.com' } }
};

beforeEach(() => {
    state.profile = null;
});

describe('site manifest route', () => {
    test('reports a missing profile as not found', async () => {
        await expect(manifest.GET(event)).rejects.toMatchObject({ status: 404 });
    });

    test('describes the site from its profile and avatar icons', async () => {
        state.profile = {
            name: 'Ada',
            username: '@ada',
            bio: 'Bio',
            headline: 'Engineer',
            email: 'ada@example.com',
            manifestSettings: { lang: 'en' },
            avatarVersion: 'v1',
            siteUrl: 'https://example.com',
            createdAt: 'c',
            updatedAt: 'u'
        };
        const response = await manifest.GET(event);
        expect(response.headers.get('content-type')).toContain('application/manifest+json');
        const body = (await response.json()) as {
            name: string;
            short_name: string;
            description: string;
            display: string;
            lang: string;
            icons: Array<{ sizes: string; src: string }>;
        };
        expect(body).toMatchObject({
            name: 'Ada',
            short_name: 'ada',
            description: 'Bio',
            display: 'standalone',
            lang: 'en'
        });
        expect(body.icons.map(icon => icon.sizes)).toEqual(['192x192', '512x512']);
        expect(body.icons[0].src).toContain('android-chrome-192x192.png');
    });
});
