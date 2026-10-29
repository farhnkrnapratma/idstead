import { afterNavigate, goto } from '$app/navigation';
import { page } from '$app/state';
import { mdrsFragment, resolveMdrsHash } from '@mdrs/dom/headingAnchors.ts';

export function clearArticleHash(): void {
    if (!window.location.hash) return;
    void goto(window.location.pathname + window.location.search, {
        shallow: true,
        state: page.state
    });
}

function normalizeArticleHash(container?: HTMLElement | null): void {
    const target = resolveMdrsHash(window.location.hash, container);
    if (!target) return;
    const fragment = `#${mdrsFragment(target.id)}`;
    if (window.location.hash !== fragment)
        void goto(fragment, { shallow: true, replace: true, state: page.state });
}

export function normalizeArticleHashOnEnter(container: () => HTMLElement | null | undefined): void {
    afterNavigate(({ type }) => {
        if (type === 'enter') normalizeArticleHash(container());
    });
}
