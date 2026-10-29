import { afterNavigate, goto } from '$app/navigation';
import { page } from '$app/state';
import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';
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

export function announceLinkCopy(_url: string, copied: boolean): void {
    if (copied) toastStore.success('Link copied');
    else toastStore.error('Copy failed');
}
