// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import {
    activateHeadingAnchor,
    enhanceHeadingAnchors,
    mdrsFragment,
    resolveMdrsHash
} from '../packages/mdrs/dom/src/headingAnchors.ts';

function article(html: string) {
    const container = document.createElement('article');
    container.innerHTML = html;
    document.body.appendChild(container);
    return container;
}

beforeEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '';
});

describe('mdrsFragment', () => {
    test('drops the namespace prefix only when present', () => {
        expect(mdrsFragment('mdrs-intro')).toBe('intro');
        expect(mdrsFragment('intro')).toBe('intro');
    });
});

describe('resolveMdrsHash', () => {
    test('resolves exact, namespaced and invalid hashes', () => {
        const container = article('<h2 id="mdrs-intro">Intro</h2><h2 id="plain">Plain</h2>');
        expect(resolveMdrsHash('')).toBeNull();
        expect(resolveMdrsHash('#')).toBeNull();
        expect(resolveMdrsHash('#%E0%A4%A')).toBeNull();
        expect(resolveMdrsHash('#plain')?.id).toBe('plain');
        expect(resolveMdrsHash('#mdrs-intro')?.id).toBe('mdrs-intro');
        expect(resolveMdrsHash('#intro')?.id).toBe('mdrs-intro');
        expect(resolveMdrsHash('#intro', container)?.id).toBe('mdrs-intro');
        expect(resolveMdrsHash('intro', container)?.id).toBe('mdrs-intro');
        expect(resolveMdrsHash('#absent', container)).toBeNull();
        expect(resolveMdrsHash('#mdrs-absent')).toBeNull();
    });

    test('prefers the namespaced heading when the id wraps the container', () => {
        const outer = article(
            '<section id="docs"><div id="inner"><h2 id="mdrs-docs">Docs</h2></div></section>'
        );
        const inner = outer.querySelector<HTMLElement>('#inner')!;
        expect(resolveMdrsHash('#docs', inner)?.id).toBe('mdrs-docs');
        expect(resolveMdrsHash('#docs')?.id).toBe('docs');
    });
});

describe('activateHeadingAnchor', () => {
    test('moves the active marker between anchors', () => {
        const container = article(
            '<h2 class="mdrs-heading"><a class="mdrs-anchor mdrs-is-active"></a></h2><h2 class="mdrs-heading"><a class="mdrs-anchor"></a></h2>'
        );
        const [first, second] = container.querySelectorAll<HTMLAnchorElement>('a');
        activateHeadingAnchor(second);
        expect(first.classList.contains('mdrs-is-active')).toBe(false);
        expect(second.classList.contains('mdrs-is-active')).toBe(true);
    });
});

describe('enhanceHeadingAnchors', () => {
    test('adds permalinks after the last word of each heading', () => {
        window.location.hash = '#mdrs-second';
        const container = article(
            [
                '<h2 id="mdrs-first">First section</h2>',
                '<h2 id="mdrs-second"><em>Second</em> part </h2>',
                '<h3 id="mdrs-single">Single</h3>',
                '<h3>No id</h3>',
                '<h4 id="mdrs-empty"></h4>',
                '<h4 id="mdrs-icon"><svg></svg></h4>',
                '<div class="mdrs-chart"><h2 id="mdrs-chart-title">Chart</h2></div>',
                '<div class="mdrs-mermaid"><h2 id="mdrs-mermaid-title">Diagram</h2></div>'
            ].join('')
        );
        const stop = enhanceHeadingAnchors(container);

        const anchors = [...container.querySelectorAll<HTMLAnchorElement>('a.mdrs-anchor')];
        expect(anchors.map(anchor => anchor.getAttribute('href'))).toEqual([
            '#mdrs-first',
            '#mdrs-second',
            '#mdrs-single',
            '#mdrs-empty',
            '#mdrs-icon'
        ]);
        expect(anchors[1].classList.contains('mdrs-is-active')).toBe(true);
        expect(anchors[0].classList.contains('mdrs-is-active')).toBe(false);
        expect(container.querySelector('.mdrs-heading-tail')?.textContent).toBe('section');
        expect(container.querySelector('#mdrs-chart-title .mdrs-anchor')).toBeNull();

        anchors[0].dispatchEvent(new window.Event('click'));
        expect(anchors[0].classList.contains('mdrs-is-active')).toBe(true);
        expect(anchors[1].classList.contains('mdrs-is-active')).toBe(false);

        enhanceHeadingAnchors(container);
        expect(container.querySelectorAll('.mdrs-heading-actions').length).toBe(5);
        stop();
    });

    test('keeps a heading tail that already exists and trailing spaces', () => {
        const container = article(
            '<h2 id="a"><span class="mdrs-heading-text">Lead <span class="mdrs-heading-tail">tail</span></span></h2><h2 id="b">One two  </h2>'
        );
        enhanceHeadingAnchors(container);
        expect(container.querySelectorAll('.mdrs-heading-tail').length).toBe(2);
    });

    test('uses bare fragments and delegates actions to mountActions', () => {
        const container = article('<h2 id="mdrs-intro">Intro text</h2><h2 id="plain">Plain</h2>');
        const links: Record<string, string>[] = [];
        let cleaned = 0;
        const stop = enhanceHeadingAnchors(container, {
            bareFragments: true,
            mountActions: (slot, link) => {
                links.push({ ...link });
                slot.dataset.mounted = 'true';
                return () => void cleaned++;
            }
        });
        expect(links.map(link => link.fragment)).toEqual(['intro', 'plain']);
        expect(links[0].url.endsWith('#intro')).toBe(true);
        expect(links[0].text).toBe('Intro text');
        expect(container.querySelectorAll('[data-mounted="true"]').length).toBe(2);
        stop();
        stop();
        expect(cleaned).toBe(2);
    });
});
