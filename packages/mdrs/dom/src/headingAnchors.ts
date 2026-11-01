// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

const ANCHOR_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-pilcrow" aria-hidden="true"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>';

export function mdrsFragment(id: string): string {
    return id.startsWith('mdrs-') ? id.slice(5) : id;
}

export function resolveMdrsHash(hash: string, container?: HTMLElement | null): HTMLElement | null {
    let id = hash.replace(/^#/, '');
    if (!id) return null;
    try {
        id = decodeURIComponent(id);
    } catch {
        return null;
    }
    const exact = document.getElementById(id);
    if (exact && (!container || !exact.contains(container))) return exact;
    if (id.startsWith('mdrs-')) return exact;
    const scope = container ?? document;
    return scope.querySelector<HTMLElement>(`#mdrs-${CSS.escape(id)}`) ?? exact;
}

export function activateHeadingAnchor(anchor: HTMLAnchorElement): void {
    document
        .querySelectorAll('.mdrs-heading a.mdrs-anchor.mdrs-is-active')
        .forEach(activeAnchor => activeAnchor.classList.remove('mdrs-is-active'));
    anchor.classList.add('mdrs-is-active');
}

export interface HeadingLink {
    id: string;
    fragment: string;
    url: string;
    text: string;
}

export interface HeadingAnchorOptions {
    bareFragments?: boolean;
    mountActions?: (slot: HTMLElement, link: HeadingLink) => () => void;
}

function headingTail(headingText: HTMLElement): HTMLElement | null {
    const existing = headingText.querySelector<HTMLElement>('.mdrs-heading-tail');
    if (existing) return existing;

    const walker = document.createTreeWalker(headingText, NodeFilter.SHOW_TEXT);
    let lastTextNode: Text | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
        if (node.nodeValue && node.nodeValue.trim().length > 0) {
            lastTextNode = node as Text;
        }
    }

    const match = lastTextNode?.nodeValue?.match(/^(.*?)(\s+)?(\S+)(\s*)$/);
    const parent = lastTextNode?.parentNode;
    if (!lastTextNode || !match || !parent) return null;

    const [, before, space, lastWord, trailingSpace] = match;
    const tail = document.createElement('span');
    tail.className = 'mdrs-heading-tail';
    tail.textContent = lastWord;
    if (before) parent.insertBefore(document.createTextNode(before + (space || '')), lastTextNode);
    parent.insertBefore(tail, lastTextNode);
    if (trailingSpace) parent.insertBefore(document.createTextNode(trailingSpace), lastTextNode);
    parent.removeChild(lastTextNode);
    return tail;
}

function permalinkAnchor(
    heading: HTMLElement,
    href: string,
    container: HTMLElement
): HTMLAnchorElement {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.className = 'mdrs-anchor';
    anchor.setAttribute('aria-label', 'Permanent link');
    anchor.dataset.tooltip = 'Permanent link';
    anchor.innerHTML = ANCHOR_ICON;
    if (resolveMdrsHash(window.location.hash, container)?.id === heading.id)
        anchor.classList.add('mdrs-is-active');
    anchor.addEventListener('click', () => activateHeadingAnchor(anchor));
    return anchor;
}

export function enhanceHeadingAnchors(
    container: HTMLElement,
    { bareFragments = false, mountActions }: HeadingAnchorOptions = {}
): () => void {
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(
        el => !el.closest('.mdrs-chart') && !el.closest('.mdrs-mermaid')
    ) as HTMLElement[];
    const cleanups: (() => void)[] = [];

    headings.forEach(el => {
        if (!el.id) return;

        el.classList.add('mdrs-heading');
        el.querySelector('.mdrs-heading-actions')?.remove();

        let headingText = el.querySelector('.mdrs-heading-text') as HTMLElement | null;
        if (!headingText) {
            headingText = document.createElement('span');
            headingText.className = 'mdrs-heading-text';
            while (el.firstChild) {
                headingText.appendChild(el.firstChild);
            }
            el.appendChild(headingText);
        }

        const fragment = bareFragments ? mdrsFragment(el.id) : el.id;
        const text = headingText.textContent?.trim() ?? '';
        const slot = document.createElement('span');
        slot.className = 'mdrs-heading-actions';
        (headingTail(headingText) ?? headingText).appendChild(slot);

        if (mountActions) {
            cleanups.push(
                mountActions(slot, {
                    id: el.id,
                    fragment,
                    url: `${window.location.origin}${window.location.pathname}#${fragment}`,
                    text
                })
            );
        } else {
            slot.appendChild(permalinkAnchor(el, `#${fragment}`, container));
        }
    });

    return () => cleanups.splice(0).forEach(cleanup => cleanup());
}
