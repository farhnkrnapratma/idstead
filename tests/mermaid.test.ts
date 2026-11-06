// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, mock, test } from 'bun:test';

const renders: { id: string; code: string }[] = [];
const initializations: Record<string, any>[] = [];
let renderFails = false;
let initializeFails = false;

mock.module('mermaid', () => ({
    default: {
        initialize: (config: Record<string, any>) => {
            if (initializeFails) throw new Error('init failed');
            initializations.push(config);
        },
        render: async (id: string, code: string) => {
            renders.push({ id, code });
            if (renderFails) throw new Error('bad diagram');
            return { svg: `<svg data-id="${id}"><g/></svg>` };
        }
    }
}));

const { enhanceMermaidBlocks, getMermaid, initMermaidThemeObserver } =
    await import('../packages/mdrs/dom/src/mermaid.ts');

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const fire = (node: Element | Window, type: string) =>
    node.dispatchEvent(new window.Event(type, { bubbles: true }));
let written: string[] = [];
let clipboardFails = false;

function block(source: string | null, parts: { source?: boolean; display?: boolean } = {}) {
    const root = document.createElement('div');
    root.className = 'mdrs-mermaid';
    if (parts.source !== false) {
        const code = document.createElement('div');
        code.className = 'mdrs-mermaid-source';
        if (source !== null) code.setAttribute('data-mdrs-source', encodeURIComponent(source));
        root.appendChild(code);
    }
    if (parts.display !== false) {
        const display = document.createElement('div');
        display.className = 'mdrs-mermaid-display';
        root.appendChild(display);
    }
    document.body.appendChild(root);
    return root;
}

beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.className = '';
    renders.length = 0;
    initializations.length = 0;
    renderFails = false;
    initializeFails = false;
    clipboardFails = false;
    written = [];
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: async (text: string) => {
                if (clipboardFails) throw new Error('denied');
                written.push(text);
            }
        }
    });
});

describe('getMermaid', () => {
    test('initializes the shared instance with a theme per call', async () => {
        const dark = await getMermaid();
        await getMermaid(false);
        expect(typeof dark.render).toBe('function');
        expect(initializations.map(config => config.themeVariables.darkMode)).toEqual([
            true,
            false
        ]);
        expect(initializations[0].securityLevel).toBe('strict');
        expect(initializations[0].themeVariables.git0).toBe(
            initializations[0].themeVariables.primaryColor
        );
    });
});

describe('enhanceMermaidBlocks', () => {
    test('renders diagrams, skips fresh ones and re-renders on theme change', async () => {
        const first = block('graph TD\n A-->B');
        await enhanceMermaidBlocks();
        expect(renders.length).toBe(1);
        expect(first.getAttribute('data-mdrs-theme')).toBe('light');
        expect(first.querySelector('svg')?.classList.contains('mdrs-mermaid-svg')).toBe(true);
        expect(first.querySelectorAll('.mdrs-mermaid-toolbar').length).toBe(1);

        await enhanceMermaidBlocks(document.body, false);
        expect(renders.length).toBe(1);

        await enhanceMermaidBlocks(document.body, true);
        expect(renders.length).toBe(2);
        expect(first.getAttribute('data-mdrs-theme')).toBe('dark');
        expect(first.querySelectorAll('.mdrs-mermaid-toolbar').length).toBe(1);

        await enhanceMermaidBlocks(document.body, 'light');
        expect(first.getAttribute('data-mdrs-theme')).toBe('light');
        await enhanceMermaidBlocks(document.body, 'dark');
        expect(first.getAttribute('data-mdrs-theme')).toBe('dark');
        document.documentElement.classList.add('dark');
        first.removeAttribute('data-mdrs-theme');
        await enhanceMermaidBlocks();
        expect(first.getAttribute('data-mdrs-theme')).toBe('dark');
    });

    test('ignores incomplete blocks and empty sources', async () => {
        block('graph TD\n A-->B', { display: false });
        block('graph TD\n A-->B', { source: false });
        block('   ');
        block(null);
        await enhanceMermaidBlocks();
        expect(renders).toEqual([]);
        await enhanceMermaidBlocks(document.createElement('div'));
        expect(renders).toEqual([]);
    });

    test('shows render failures inline', async () => {
        const failing = block('not a diagram');
        renderFails = true;
        await enhanceMermaidBlocks();
        expect(failing.querySelector('.mdrs-mermaid-error')?.textContent).toBe(
            'Failed to render Mermaid diagram: bad diagram'
        );
    });

    test('re-renders when the site theme changes', async () => {
        const watched = block('graph TD\n A-->B');
        initMermaidThemeObserver();
        initMermaidThemeObserver();
        await enhanceMermaidBlocks();
        const before = renders.length;
        document.documentElement.classList.add('dark');
        await flush();
        await flush();
        expect(renders.length).toBeGreaterThan(before);
        expect(watched.getAttribute('data-mdrs-theme')).toBe('dark');
    });

    test('reports failures while re-rendering after a theme change', async () => {
        block('graph TD\n A-->B');
        await enhanceMermaidBlocks();
        const original = console.error;
        const errors: unknown[] = [];
        console.error = (...args: unknown[]) => void errors.push(args);
        initializeFails = true;
        document.documentElement.classList.toggle('dark');
        document.querySelector('.mdrs-mermaid')!.removeAttribute('data-mdrs-theme');
        await flush();
        await flush();
        console.error = original;
        expect(errors.length).toBe(1);
    });

    test('defaults to the dark theme without a document', async () => {
        const detached = document.createElement('div');
        const saved = globalThis.document;
        (globalThis as any).document = undefined;
        try {
            await enhanceMermaidBlocks(detached);
        } finally {
            (globalThis as any).document = saved;
        }
        expect(renders).toEqual([]);
    });

    test('copies the svg and the source from the toolbar', async () => {
        const target = block('graph TD\n A-->B');
        await enhanceMermaidBlocks();
        const toolbar = target.querySelector('.mdrs-mermaid-toolbar')!;
        const menu = toolbar.querySelector('.mdrs-menu')!;
        const [menuButton] = toolbar.querySelectorAll('button');
        const [copySvg, copyCode] = toolbar.querySelectorAll('.mdrs-menu-item');

        fire(menuButton, 'click');
        expect(menu.classList.contains('mdrs-is-open')).toBe(true);
        fire(toolbar, 'click');
        expect(menu.classList.contains('mdrs-is-open')).toBe(true);
        fire(document.body, 'click');
        expect(menu.classList.contains('mdrs-is-open')).toBe(false);

        fire(menuButton, 'click');
        fire(copySvg, 'click');
        fire(copyCode, 'click');
        await flush();
        expect(written[0]).toContain('<svg');
        expect(written[1]).toBe('graph TD\n A-->B');
        expect(copySvg.textContent).toBe('Copied SVG!');
        expect(copyCode.textContent).toBe('Copied Code!');
        await new Promise(resolve => setTimeout(resolve, 1250));
        expect(copySvg.textContent).toBe('Copy SVG');
        expect(copyCode.textContent).toBe('Copy code');
        expect(menu.classList.contains('mdrs-is-open')).toBe(false);

        clipboardFails = true;
        fire(copySvg, 'click');
        fire(copyCode, 'click');
        await flush();
        expect(copySvg.textContent).toBe('Copy SVG');

        target.remove();
        fire(window, 'click');
    });
});
