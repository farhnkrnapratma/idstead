// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import {
    buttons,
    chooseFile,
    click,
    confirmDialog,
    failure,
    openAdmin,
    route,
    settle,
    text,
    toast
} from './support/adminHarness.ts';

const pages = [
    ['privacy', 'Privacy Policy'],
    ['security', 'Security Policy'],
    ['terms', 'Terms of Service'],
    ['ai-disclosure', 'AI Disclosure']
] as const;

afterEach(() => localStorage.clear());

function draft(slug: string, content: string) {
    localStorage.setItem(
        `autosave_legal_${slug}`,
        JSON.stringify({ content, timestamp: Date.parse('2026-05-01T10:00:00Z') })
    );
}

function importInput() {
    const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="Import a Markdown or MDRS file"]'
    );
    if (!input) throw new Error('No import input');
    return input;
}

async function openLegal(slug: string) {
    await openAdmin(`?tab=${slug}`);
    await settle(10);
}

for (const [slug, title] of pages) {
    test(`${title}: a local draft can be restored or discarded`, async () => {
        draft(slug, `# ${slug}\n\nA newer draft`);
        await openLegal(slug);
        expect(text()).toContain('Autosaved local draft found');
        await click('Restore draft');
        expect(toast().message).toBe(`Restored draft for ${slug}`);
        expect(text()).not.toContain('Autosaved local draft found');

        document.body.innerHTML = '';
        draft(slug, `# ${slug}\n\nAnother draft`);
        await openLegal(slug);
        await click('Discard');
        expect(toast().message).toBe(`Discarded draft for ${slug}`);
        expect(localStorage.getItem(`autosave_legal_${slug}`)).toBeNull();
    });

    test(`${title}: saving reports errors and success`, async () => {
        await openLegal(slug);
        const form = buttons(`Save ${title}`)[0]?.closest('form');
        route('POST legal', () => failure('Content is too long.'));
        form?.requestSubmit();
        await settle(10);
        expect(toast()).toEqual({ message: 'Error: Content is too long.', type: 'error' });

        route('POST legal', () => ({ success: true }));
        form?.requestSubmit();
        await settle(10);
        expect(toast().message).toBe(`${slug} saved successfully`);
    });
}

test('drafts that match the saved text, are blank or are malformed are ignored', async () => {
    draft('privacy', '# privacy\n\nBody');
    draft('security', '   ');
    localStorage.setItem('autosave_legal_terms', '{not json');
    localStorage.setItem('autosave_legal_ai-disclosure', JSON.stringify({ other: true }));
    await openLegal('privacy');
    expect(text()).not.toContain('Autosaved local draft found');
});

test('importing a file checks its type, size and readability, and asks before replacing', async () => {
    await openLegal('privacy');

    await chooseFile(importInput(), new File(['text'], 'notes.txt'));
    expect(toast()).toEqual({ message: 'Choose a .md or .mdrs file.', type: 'error' });

    await chooseFile(importInput(), new File([new Uint8Array(1024 * 1024 + 1)], 'huge.md'));
    expect(toast()).toEqual({ message: 'That file is too large to import.', type: 'error' });

    const unreadable = new File(['x'], 'broken.md');
    unreadable.text = () => Promise.reject(new Error('locked'));
    await chooseFile(importInput(), unreadable);
    expect(toast()).toEqual({ message: 'The file could not be read.', type: 'error' });

    await chooseFile(importInput(), new File(['# Imported'], 'policy.mdrs'));
    expect(text()).toContain('Replace the current content?');
    await click('Keep editing');
    expect(text()).not.toContain('Replace the current content?');

    await chooseFile(importInput(), new File(['# Imported'], 'policy.md'));
    await confirmDialog('Import file');
    expect(toast().message).toBe('File imported.');
});

test('importing into an empty page needs no confirmation', async () => {
    route('GET legal', () => ({ pages: [] }));
    await openLegal('terms');
    await chooseFile(importInput(), new File(['# Terms'], 'terms.markdown'));
    expect(toast().message).toBe('File imported.');
    expect(text()).not.toContain('Replace the current content?');
});
