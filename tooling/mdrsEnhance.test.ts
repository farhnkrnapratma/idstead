// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, expect, test } from 'bun:test';
import { enhanceMarkdownContent } from '../packages/mdrs/dom/src/enhance.ts';

afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.classList.remove('dark');
});

const details = () => `
    <details class="mdrs-details">
        <summary><span class="mdrs-details-title">Install steps</span></summary>
        <p>Run the command.</p>
    </details>`;

test('enhances collapsible sections once and skips markup it already handled', async () => {
    document.body.innerHTML = `<div id="post">${details()}</div>`;
    const container = document.getElementById('post') as HTMLElement;
    await enhanceMarkdownContent({ container, isDark: false });
    const section = container.querySelector<HTMLDetailsElement>('details.mdrs-details');
    expect(section?.dataset.mdrsEnhanced).toBe('true');
    await enhanceMarkdownContent({ container, isDark: false });
    expect(container.querySelectorAll('[data-mdrs-enhanced="true"]').length).toBe(1);
});

test('ignores sections without a summary', async () => {
    document.body.innerHTML = `<div id="post"><details class="mdrs-details"><p>No summary</p></details></div>`;
    const container = document.getElementById('post') as HTMLElement;
    await enhanceMarkdownContent({ container, isDark: true });
    expect(container.querySelector('details')?.dataset.mdrsEnhanced).toBeUndefined();
});

test('reads the theme from the document when it is not given', async () => {
    document.documentElement.classList.add('dark');
    document.body.innerHTML = `<div id="post">${details()}</div>`;
    await enhanceMarkdownContent({ container: document.getElementById('post') });
    expect(
        document.querySelector<HTMLDetailsElement>('details.mdrs-details')?.dataset.mdrsEnhanced
    ).toBe('true');
});

test('defaults to the document body and to dark when nothing is given', async () => {
    document.body.innerHTML = details();
    await enhanceMarkdownContent();
    expect(
        document.querySelector<HTMLDetailsElement>('details.mdrs-details')?.dataset.mdrsEnhanced
    ).toBe('true');
});
