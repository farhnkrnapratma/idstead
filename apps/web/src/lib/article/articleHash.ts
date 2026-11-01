// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterNavigate, goto } from '$app/navigation';
import { page } from '$app/state';
import { mdrsFragment, resolveMdrsHash } from '@mdrs/dom/headingAnchors.ts';

function hashFragment(hash: string): string {
    try {
        return decodeURIComponent(hash.replace(/^#/, ''));
    } catch {
        return '';
    }
}

export function currentPermalink(): string {
    return page.state.permalink ?? hashFragment(page.url.hash);
}

export function showArticleFragment(id: string, replace = false): void {
    const permalink = mdrsFragment(id);
    void goto(`#${permalink}`, { shallow: true, replace, state: { ...page.state, permalink } });
}

export function clearArticleHash(): void {
    if (!window.location.hash) return;
    void goto(window.location.pathname + window.location.search, {
        shallow: true,
        state: { ...page.state, permalink: '' }
    });
}

function normalizeArticleHash(container?: HTMLElement | null): void {
    const target = resolveMdrsHash(window.location.hash, container);
    if (!target) return;
    if (window.location.hash !== `#${mdrsFragment(target.id)}`)
        showArticleFragment(target.id, true);
}

export function normalizeArticleHashOnEnter(container: () => HTMLElement | null | undefined): void {
    afterNavigate(({ type }) => {
        if (type === 'enter') normalizeArticleHash(container());
    });
}
