// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, mock, test } from 'bun:test';
import { flushSync, mount, tick, unmount } from 'svelte';
import {
    resumeDocumentInfo,
    RESUME_CHECKSUM_ALGORITHMS
} from '../packages/lib/src/resumeVerification.ts';

const ResumeDownloadMenu = (
    (await import('../apps/web/src/lib/components/ResumeDownloadMenu.svelte')) as { default: never }
).default;

const FPR = '73C032AD78AC6F2E7CE781A27ABA82BF0C80A58C';
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

test('lists downloads, checksums and verification steps for a signed resume', async () => {
    const checksums = Object.fromEntries(
        RESUME_CHECKSUM_ALGORITHMS.map(({ ext }) => [ext, 'ab'.repeat(32)])
    ) as never;
    const info = resumeDocumentInfo(
        {
            filename: 'resume',
            version: '3',
            updatedAt: '2026-02-01T00:00:00.000Z',
            checksums,
            signedAt: '2026-01-02T00:00:00.000Z',
            signerFingerprint: FPR
        },
        {
            fingerprint: FPR,
            userIds: [{ name: 'Ada', email: 'ada@example.com' }],
            keyservers: [{ label: 'keys.openpgp.org', url: 'https://keys.openpgp.org/x' }]
        } as never,
        'https://example.com',
        'https://api.example.com'
    );
    mounted.push(
        mount(ResumeDownloadMenu, {
            target: document.body,
            props: {
                document: info,
                shortcutGroup: 'resume',
                shortcutChordKey: 'r',
                placement: 'bottom-end'
            } as never
        })
    );
    await settle();
    document.querySelector<HTMLElement>('button')?.click();
    flushSync();
    await settle();
    const verify = [...document.querySelectorAll<HTMLElement>('button')].find(button =>
        /verify/i.test(button.textContent ?? '')
    );
    verify?.click();
    flushSync();
    await settle();
    for (const button of [
        ...document.querySelectorAll<HTMLElement>('[role="menuitem"], button')
    ].slice(0, 12)) {
        button.click();
        flushSync();
    }
    await settle();
    expect(document.body.textContent).toContain('resume');
}, 60000);
