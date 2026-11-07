// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { createD1AdminAuthorStore } from '../packages/data/src/d1/adminAuthor.ts';
import { d1Shim } from './support/d1.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ASSETS = [
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png',
    'avatar.avif',
    'avatar.png',
    'avatar.webp',
    'banner-og.webp',
    'banner.avif',
    'banner.webp',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.ico',
    'favicon.svg'
].map(name => ({ name, key: `identity/v/${name}` }));

const profile = {
    name: 'Ada',
    username: 'ada',
    headline: 'Engineer',
    job_title: 'Engineer',
    bio: 'Bio',
    email: 'ada@example.com',
    city: 'City',
    postal_code: '1',
    country: 'ID',
    site_url: 'https://example.com/',
    pronunciation: null
};

async function registered(store: ReturnType<typeof createD1AdminAuthorStore>, id: string) {
    await store.registerIdentityVersion({
        id,
        kind: 'identity',
        source: 'custom',
        avatar_source: 'custom',
        banner_source: 'custom',
        assets: [],
        retired_at: new Date().toISOString()
    });
}

describe('D1 admin author constraint failures', () => {
    test('reports constraint violations on the profile write', async () => {
        const { db } = d1Shim();
        const store = createD1AdminAuthorStore(db);
        await registered(store, uuid(1));
        const first = await store.saveProfile(profile, { version: uuid(1), assets: ASSETS });
        expect(first.status).toBe('saved');
        const outcomes = [
            await store.saveProfile(
                { ...profile, name: null as never },
                { version: uuid(2), assets: ASSETS }
            ),
            await store.saveProfile(
                { ...profile, headline: 'x'.repeat(10_000) },
                { version: uuid(2), assets: ASSETS }
            ),
            await store.saveProfile(
                { ...profile, email: 'not-an-email' },
                { version: uuid(2), assets: ASSETS }
            )
        ];
        for (const outcome of outcomes) {
            expect(outcome.status).toBe('failed');
        }
    });
});
