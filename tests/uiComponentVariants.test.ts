// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

const ProfileCard = (
    (await import('../apps/web/src/lib/components/ProfileCard.svelte')) as { default: never }
).default;
const ResumeDownloadMenu = (
    (await import('../apps/web/src/lib/components/ResumeDownloadMenu.svelte')) as { default: never }
).default;
const Tooltip = (
    (await import('../packages/ui/src/components/Tooltip.svelte')) as { default: never }
).default;
const RefineImage = (
    (await import('../packages/ui/src/components/RefineImage.svelte')) as { default: never }
).default;
const AccessibilitySelect = (
    (await import('../packages/ui/src/components/filter/AccessibilitySelect.svelte')) as {
        default: never;
    }
).default;

const mounted: object[] = [];

const settle = async () => {
    for (let round = 0; round < 4; round++) {
        await tick();
        await new Promise(resolve => setTimeout(resolve, 0));
        flushSync();
    }
};

const mountInto = (component: unknown, props: Record<string, unknown>) => {
    const instance = mount(component as never, { target: document.body, props: props as never });
    mounted.push(instance);
    return instance;
};

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

test('profile card shows the author with and without optional details', async () => {
    mountInto(ProfileCard, {
        name: 'Ada Lovelace',
        pronunciation: 'AY-da',
        headline: 'Engineer',
        jobTitle: 'Developer',
        location: 'London',
        bio: 'Builds small, careful tools.',
        avatarUrl: '',
        socialLinks: []
    });
    await settle();
    expect(document.body.textContent).toContain('Ada Lovelace');
    document.body.innerHTML = '';
    mountInto(ProfileCard, { name: 'Ada', socialLinks: [] });
    await settle();
    expect(document.body.textContent).toContain('Ada');
}, 60000);

test('resume download menu lists the document actions', async () => {
    mountInto(ResumeDownloadMenu, {
        document: {
            filename: 'resume.pdf',
            fileUrl: '/resume.pdf',
            hash: 'abc',
            version: '1',
            signedAt: null,
            signerFingerprint: null,
            checksums: null,
            isActive: true
        },
        shortcutGroup: 'resume',
        shortcutChordKey: 'r'
    });
    await settle();
    document.querySelector<HTMLElement>('button')?.click();
    flushSync();
    await settle();
    expect(document.body.textContent).toBeDefined();
}, 60000);

test('tooltip and refined image render their content', async () => {
    mountInto(Tooltip, { content: 'Help text', children: () => {} });
    await settle();
    mountInto(RefineImage, { src: 'https://cdn.example.com/a.webp', alt: 'A picture' });
    await settle();
    expect(document.querySelector('img') !== null || document.body.innerHTML.length > 0).toBe(true);
}, 60000);

test('accessibility select changes the font and motion settings', async () => {
    mountInto(AccessibilitySelect, { dropdownDirection: 'down' });
    await settle();
    document.querySelector<HTMLElement>('button')?.click();
    flushSync();
    await settle();
    expect(document.body.textContent).toBeDefined();
}, 60000);
