// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { expect, mock, test } from 'bun:test';
import {
    chooseFile,
    click,
    confirmDialog,
    failure,
    openAdmin,
    route,
    sent,
    settle,
    text,
    toast,
    type
} from './support/adminHarness.ts';
import { snapshot } from './fixtures/admin.ts';

const lib = new URL('../apps/admin/src/lib/', import.meta.url).pathname;
const generator = { fail: false };

const banner = () => ({
    wide: { webp: new Blob(['w'], { type: 'image/webp' }), avif: new Blob(['a']) },
    og: { webp: new Blob(['o']) },
    width: 1280,
    height: 640
});
const avatar = () => ({ files: { 'avatar.png': new Uint8Array([1, 2]).buffer } });

mock.module(`${lib}identityFallback.ts`, () => ({
    avatarFingerprint: async (seed: string) => `avatar:${seed}`,
    bannerFingerprint: async () => 'banner:fp',
    avatarPreview: () => 'data:image/png;base64,AA==',
    renderBanner: async () => {
        if (generator.fail) throw new Error('Canvas is unavailable.');
        const canvas = document.createElement('canvas');
        canvas.toDataURL = () => 'data:image/png;base64,AA==';
        return canvas;
    },
    generateAvatarPackage: async () => {
        if (generator.fail) throw new Error('Canvas is unavailable.');
        return avatar();
    },
    generateBannerPackage: async () => banner()
}));
mock.module(`${lib}processAvatar.ts`, () => ({ processAvatar: async () => avatar() }));
mock.module(`${lib}processSiteBanner.ts`, () => ({ processSiteBanner: async () => banner() }));

const saved = {
    profile: {
        id: 'author-1',
        name: 'Ada King',
        username: 'ada',
        pronunciation: 'AY-da',
        headline: 'Engineer &amp; writer',
        avatar: '/avatar.png',
        profile_revision: 5,
        avatar_version: 'a2',
        banner_version: 'b2'
    }
};

function field(id: string) {
    const element = document.querySelector<HTMLInputElement>(`#${id}`);
    if (!element) throw new Error(`No field ${id}`);
    return element;
}

async function profileFormSubmit() {
    field('author-name').closest('form')?.requestSubmit();
    await settle(10);
}

function lastProfileForm() {
    return sent('POST', 'profile').at(-1)?.body as FormData;
}

test('saving a profile with new images uploads them and decodes the saved fields', async () => {
    route('POST profile', () => saved);
    route('POST resume/generate', () => ({ success: true, upToDate: true, version: '1.0' }));
    await openAdmin('?tab=profile');

    await chooseFile(
        field('profile-image-file'),
        new File(['png'], 'me.png', { type: 'image/png' })
    );
    await chooseFile(field('site-banner-file'), new File(['png'], 'b.png', { type: 'image/png' }));
    await settle(10);
    await type(field('author-name'), 'Ada King');
    await type(field('author-username'), '@ada  ');
    await profileFormSubmit();

    expect(toast().message).toBe('Author profile saved.');
    const form = lastProfileForm();
    expect(form.get('avatar.png')).toBeInstanceOf(Blob);
    expect(form.get('banner.webp')).toBeInstanceOf(Blob);
    expect(JSON.parse(String(form.get('identity')))).toEqual({
        avatar: { source: 'custom', fingerprint: null },
        banner: { source: 'custom', fingerprint: null }
    });
    expect(JSON.parse(String(form.get('profile')))).toMatchObject({
        name: 'Ada King',
        username: 'ada'
    });
    expect(field('author-headline').value).toBe('Engineer & writer');
    expect(sent('POST', 'resume/generate').length).toBeGreaterThan(0);
});

test('a rejected profile save marks the fields the server names', async () => {
    route(
        'POST profile',
        () =>
            new Response(
                JSON.stringify({
                    error: {
                        message: 'Some fields are invalid.',
                        details: JSON.stringify({ fields: { username: 'That username is taken.' } })
                    }
                }),
                { status: 422, headers: { 'content-type': 'application/json' } }
            )
    );
    await openAdmin('?tab=profile');
    await type(field('author-username'), 'taken');
    await profileFormSubmit();
    expect(toast()).toEqual({ message: 'Some fields are invalid.', type: 'error' });
    expect(text()).toContain('That username is taken.');
});

test('removing both images saves generated ones in their place', async () => {
    route('POST profile', () => saved);
    await openAdmin('?tab=profile');
    await click('Remove profile image');
    await click('Remove website banner');
    await settle(10);
    await profileFormSubmit();
    expect(JSON.parse(String(lastProfileForm().get('identity')))).toEqual({
        avatar: { source: 'generated', fingerprint: expect.stringMatching(/^avatar:/) },
        banner: { source: 'generated', fingerprint: 'banner:fp' }
    });
});

test('an instance without images syncs generated ones on load and reports failures', async () => {
    const bare = { ...snapshot.profile, avatarVersion: null, bannerVersion: null };
    route('GET author', () => ({ ...snapshot, profile: bare }));
    route('POST profile', () => failure('Storage is full.', 507));
    await openAdmin('?tab=profile');
    await settle(10);
    expect(toast()).toEqual({ message: 'Storage is full.', type: 'error' });

    route('POST profile', () => saved);
    generator.fail = true;
    try {
        await openAdmin('?tab=profile');
        await settle(10);
        expect(toast().message).toBe(
            'Generated images could not be created: Canvas is unavailable.'
        );
        await new Promise(resolve => setTimeout(resolve, 350));
        await settle(4);
        expect(text()).toContain('Canvas is unavailable.');
    } finally {
        generator.fail = false;
    }

    await openAdmin('?tab=profile');
    await settle(10);
    expect(sent('POST', 'profile').length).toBeGreaterThan(0);
});

function importInput() {
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*="json"]');
    if (!input) throw new Error('No import input');
    return input;
}

test('importing profile data rejects bad JSON, reports server and section errors', async () => {
    await openAdmin('?tab=account&settings=data');

    await chooseFile(importInput(), new File(['{not json'], 'profile.json'));
    expect(toast()).toEqual({ message: 'That file is not valid JSON.', type: 'error' });

    route('POST profile/import', () => failure('Unsupported export version.', 400));
    await chooseFile(importInput(), new File(['{}'], 'profile.json'));
    expect(toast().message).toBe('Unsupported export version.');

    route('POST profile/import', () => ({ applied: ['profile'], errors: { skills: 'too many' } }));
    await chooseFile(importInput(), new File(['{"profile":{}}'], 'profile.json'));
    expect(toast()).toEqual({ message: 'Some sections failed: skills (too many)', type: 'error' });

    route('POST profile/import', () => ({ applied: ['profile', 'skills'], errors: {} }));
    await chooseFile(importInput(), new File(['{"profile":{}}'], 'profile.json'));
    expect(toast()).toEqual({ message: 'Imported: profile, skills.', type: 'success' });
});

test('exporting unlocks deleting all data, which reports failures and success', async () => {
    await openAdmin('?tab=account&settings=data');

    route('GET data/export', () => failure('Export is busy.', 503));
    await click('Export data');
    expect(toast().message).toBe('Export is busy.');

    route(
        'GET data/export',
        () =>
            new Response(new Blob(['zip']), { status: 200, headers: { 'X-Export-Warnings': '2' } })
    );
    await click('Export data');
    expect(toast().message).toBe(
        'Export incomplete: 2 items could not be read. See manifest.json in the archive.'
    );

    route('GET data/export', () => new Response(new Blob(['zip']), { status: 200 }));
    await click('Export data');

    route('POST data/delete-all', () => failure('Sign in again first.', 403));
    await click('Delete all data');
    await confirmDialog('Delete everything');
    expect(toast()).toEqual({ message: 'Sign in again first.', type: 'error' });

    route('POST data/delete-all', () => ({ success: true }));
    await confirmDialog('Delete everything');
    expect(toast().message).toBe('All site data deleted.');
});
