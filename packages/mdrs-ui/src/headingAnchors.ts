const ANCHOR_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-pilcrow" aria-hidden="true"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>';

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

export function enhanceHeadingAnchors(container: HTMLElement): void {
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(
        el => !el.closest('.mdrs-chart') && !el.closest('.mdrs-mermaid')
    ) as HTMLElement[];

    headings.forEach(el => {
        if (!el.id) return;

        el.classList.add('mdrs-heading');

        el.querySelector('.mdrs-anchor')?.remove();

        let headingText = el.querySelector('.mdrs-heading-text') as HTMLElement | null;
        if (!headingText) {
            headingText = document.createElement('span');
            headingText.className = 'mdrs-heading-text';
            while (el.firstChild) {
                headingText.appendChild(el.firstChild);
            }
            el.appendChild(headingText);
        }

        const anchor = document.createElement('a');
        anchor.href = `#${el.id}`;
        anchor.className = 'mdrs-anchor';
        anchor.tabIndex = 0;
        anchor.setAttribute('aria-label', 'Permanent link');
        anchor.dataset.tooltip = 'Permanent link';
        anchor.innerHTML = ANCHOR_ICON;
        if (resolveMdrsHash(window.location.hash, container)?.id === el.id)
            anchor.classList.add('mdrs-is-active');
        anchor.addEventListener('click', () => activateHeadingAnchor(anchor));

        const walker = document.createTreeWalker(headingText, NodeFilter.SHOW_TEXT);
        let lastTextNode: Text | null = null;
        let node: Node | null;
        while ((node = walker.nextNode())) {
            if (node.nodeValue && node.nodeValue.trim().length > 0) {
                lastTextNode = node as Text;
            }
        }

        const match = lastTextNode?.nodeValue?.match(/^(.*?)(\s+)?(\S+)(\s*)$/);
        if (lastTextNode && match) {
            const [, before, space, lastWord, trailingSpace] = match;
            const wrapSpan = document.createElement('span');
            wrapSpan.className = 'mdrs-heading-tail';
            wrapSpan.textContent = lastWord;
            wrapSpan.appendChild(anchor);

            const parent = lastTextNode.parentNode;
            if (parent) {
                if (before) {
                    parent.insertBefore(
                        document.createTextNode(before + (space || '')),
                        lastTextNode
                    );
                }
                parent.insertBefore(wrapSpan, lastTextNode);
                if (trailingSpace) {
                    parent.insertBefore(document.createTextNode(trailingSpace), lastTextNode);
                }
                parent.removeChild(lastTextNode);
            }
        } else {
            headingText.appendChild(anchor);
        }
    });
}
