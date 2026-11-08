// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';

const PostLicenseFields = (
    (await import('../apps/admin/src/lib/components/admin/PostLicenseFields.svelte')) as {
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

afterEach(() => {
    for (const instance of mounted.splice(0)) {
        try {
            void unmount(instance);
        } catch {}
    }
    document.body.innerHTML = '';
});

function render(
    credit: Record<string, string>,
    extra: Record<string, unknown> = {},
    onchange?: () => void
) {
    const props = {
        license: null,
        credit: { origin: 'own', author: '', url: '', license: '', tool: '', ...credit },
        onchange,
        ...extra
    };
    mounted.push(mount(PostLicenseFields, { target: document.body, props: props as never }));
    return props;
}

function field(id: string) {
    return document.querySelector<HTMLInputElement>(`#${id}`);
}

test('own work shows only the license and banner source dropdowns', async () => {
    render({});
    await settle();
    expect(document.querySelector('#post-license')).not.toBeNull();
    expect(document.querySelector('#post-banner-origin')).not.toBeNull();
    expect(field('post-banner-author')).toBeNull();
    expect(field('post-banner-tool')).toBeNull();
});

test('third-party banners show creator, source and license fields that report edits', async () => {
    let changes = 0;
    render({ origin: 'third-party' }, {}, () => changes++);
    await settle();
    for (const id of ['post-banner-author', 'post-banner-url', 'post-banner-license']) {
        expect(field(id)).not.toBeNull();
    }
    const author = field('post-banner-author');
    if (!author) throw new Error('creator field missing');
    author.value = 'Ada';
    author.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(changes).toBeGreaterThan(0);
});

test('AI-generated banners ask for the tool used', async () => {
    render({ origin: 'ai-generated' });
    await settle();
    expect(field('post-banner-tool')).not.toBeNull();
    expect(field('post-banner-author')).toBeNull();
});

test('field errors are shown on the matching controls and the banner source', async () => {
    render(
        { origin: 'third-party' },
        { error: { field: 'bannerCreditUrl', message: 'Enter a valid URL.' } }
    );
    await settle();
    expect(document.body.textContent).toContain('Enter a valid URL.');
});

test('banner source errors show without a credit field', async () => {
    render(
        { origin: 'own' },
        { error: { field: 'bannerOrigin', message: 'Choose a banner source.' } }
    );
    await settle();
    expect(document.body.textContent).toContain('Choose a banner source.');
});
