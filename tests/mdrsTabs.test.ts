// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, test } from 'bun:test';
import {
    enhanceMarkdownTabs,
    getTabPreference,
    onTabPreference,
    setTabPreference
} from '../packages/mdrs/dom/src/tabs.ts';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const fire = (node: Element, type: string) =>
    node.dispatchEvent(new window.Event(type, { bubbles: true }));

interface PanelSpec {
    label: string;
    code?: string;
    language?: string;
    filename?: string;
}

function tabs(
    panels: PanelSpec[],
    options: { kind?: 'snippets' | 'tabs'; key?: string; header?: boolean; actions?: boolean } = {}
) {
    const kind = options.kind ?? 'snippets';
    const root = document.createElement('div');
    root.className = 'mdrs';
    const group = document.createElement('div');
    group.className = kind === 'snippets' ? 'mdrs-snippets' : 'mdrs-tabs';
    if (options.key) group.setAttribute('data-mdrs-tab-key', options.key);
    if (options.header !== false) {
        const header = document.createElement('div');
        header.className = 'mdrs-snippets-header';
        if (options.actions) {
            const actions = document.createElement('div');
            actions.className = 'mdrs-snippets-actions';
            actions.appendChild(document.createElement('span'));
            header.appendChild(actions);
        }
        group.appendChild(header);
    }
    panels.forEach((spec, index) => {
        const button = document.createElement('button');
        button.className = 'mdrs-tab';
        button.setAttribute('data-mdrs-tab-label', spec.label);
        group.appendChild(button);
        const panel = document.createElement('div');
        panel.className = 'mdrs-tab-panel';
        panel.hidden = index !== 0;
        if (spec.code !== undefined) {
            const pre = document.createElement('pre');
            if (spec.filename) pre.dataset.mdrsFilename = spec.filename;
            const code = document.createElement('code');
            if (spec.language) code.className = `language-${spec.language}`;
            code.textContent = spec.code;
            pre.appendChild(code);
            panel.appendChild(pre);
        }
        group.appendChild(panel);
    });
    root.appendChild(group);
    document.body.appendChild(root);
    return { root, group };
}

let written: string[] = [];

beforeEach(() => {
    document.body.innerHTML = '';
    written = [];
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => void written.push(text) }
    });
    URL.createObjectURL = () => 'blob:tabs';
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = () => {};
});

describe('tab preferences', () => {
    test('stores values and notifies listeners until they unsubscribe', () => {
        const seen: string[] = [];
        const stop = onTabPreference((key, value) => seen.push(`${key}=${value}`));
        setTabPreference('os', 'linux');
        expect(getTabPreference('os')).toBe('linux');
        expect(getTabPreference('missing')).toBeUndefined();
        stop();
        setTabPreference('os', 'mac');
        expect(seen).toEqual(['os=linux']);
    });
});

describe('enhanceMarkdownTabs', () => {
    test('switches panels and adds code controls to snippet groups', async () => {
        const toasts: string[] = [];
        const { root, group } = tabs([
            { label: 'Shell', code: 'ls -la', language: 'bash' },
            { label: 'Script', code: '#!/bin/sh\nls', language: 'bash', filename: 'run.sh' },
            { label: 'Empty' }
        ]);
        enhanceMarkdownTabs(root, message => toasts.push(message));
        enhanceMarkdownTabs(root);
        await flush();

        const buttons = [...group.querySelectorAll<HTMLElement>('.mdrs-tab')];
        const panels = [...group.querySelectorAll<HTMLElement>('.mdrs-tab-panel')];
        expect(group.querySelectorAll('.mdrs-code-actions').length).toBe(1);

        fire(group.querySelector('button[aria-label="Copy code"]')!, 'click');
        await flush();
        expect(written).toEqual(['ls -la']);

        fire(buttons[1], 'click');
        expect(panels[0].hidden).toBe(true);
        expect(panels[1].hidden).toBe(false);
        expect(buttons[1].classList.contains('mdrs-is-active')).toBe(true);
        expect(buttons[1].getAttribute('aria-selected')).toBe('true');
        expect(buttons[0].getAttribute('aria-selected')).toBe('false');

        fire(group.querySelector('[role="menuitem"]')!, 'click');
        expect(toasts).toContain('Downloaded run.sh');

        fire(buttons[2], 'click');
        fire(group.querySelector('button[aria-label="Copy code"]')!, 'click');
        fire(group.querySelector('[role="menuitem"]')!, 'click');
        await flush();
    });

    test('reuses the root when the container is the mdrs element and falls back to it', () => {
        const direct = tabs([{ label: 'A', code: 'a' }]);
        enhanceMarkdownTabs(direct.group.parentElement as HTMLElement);
        const plain = document.createElement('section');
        const inner = tabs([{ label: 'A', code: 'a' }]);
        plain.appendChild(inner.group);
        document.body.appendChild(plain);
        enhanceMarkdownTabs(plain);
        expect(inner.group.dataset.mdrsEnhanced).toBe('true');
        enhanceMarkdownTabs();
    });

    test('skips controls without a header or with existing actions', () => {
        const headerless = tabs([{ label: 'A', code: 'a' }], { header: false });
        enhanceMarkdownTabs(headerless.root);
        expect(headerless.group.querySelector('.mdrs-code-actions')).toBeNull();
        const prefilled = tabs([{ label: 'A', code: 'a' }], { actions: true });
        enhanceMarkdownTabs(prefilled.root);
        expect(prefilled.group.querySelector('.mdrs-code-actions')).toBeNull();
    });

    test('content groups resize the window and carry no code controls', () => {
        const { root, group } = tabs([{ label: 'A' }, { label: 'B' }], { kind: 'tabs' });
        let resizes = 0;
        window.addEventListener('resize', () => resizes++);
        enhanceMarkdownTabs(root);
        expect(group.querySelector('.mdrs-code-actions')).toBeNull();
        fire(group.querySelectorAll('.mdrs-tab')[1], 'click');
        expect(resizes).toBe(1);
    });

    test('binds number shortcuts to the first nine tabs only', () => {
        const labels = Array.from({ length: 11 }, (_, index) => ({ label: `T${index}` }));
        const { root, group } = tabs(labels, { kind: 'tabs' });
        enhanceMarkdownTabs(root);
        expect(group.querySelectorAll('.mdrs-tab').length).toBe(11);
        fire(group.querySelectorAll('.mdrs-tab')[10], 'click');
    });

    test('keeps grouped tabs in sync through a shared key', () => {
        setTabPreference('pkg', 'pnpm');
        const first = tabs([{ label: 'npm' }, { label: 'pnpm' }], { kind: 'tabs', key: 'pkg' });
        const second = tabs([{ label: 'npm' }, { label: 'yarn' }], { kind: 'tabs', key: 'pkg' });
        const other = tabs([{ label: 'npm' }, { label: 'bun' }], { kind: 'tabs', key: 'other' });
        const unlabeled = tabs([{ label: '' }, { label: '' }], { kind: 'tabs', key: 'blank' });
        for (const entry of [first, second, other, unlabeled]) enhanceMarkdownTabs(entry.root);

        const panelsOf = (entry: { group: HTMLElement }) =>
            [...entry.group.querySelectorAll<HTMLElement>('.mdrs-tab-panel')].map(p => p.hidden);
        expect(panelsOf(first)).toEqual([true, false]);
        expect(panelsOf(second)).toEqual([false, true]);

        fire(first.group.querySelectorAll('.mdrs-tab')[0], 'click');
        expect(getTabPreference('pkg')).toBe('npm');
        expect(panelsOf(second)).toEqual([false, true]);

        setTabPreference('pkg', 'yarn');
        expect(panelsOf(second)).toEqual([true, false]);
        setTabPreference('pkg', 'missing');
        expect(panelsOf(second)).toEqual([true, false]);

        fire(unlabeled.group.querySelectorAll('.mdrs-tab')[1], 'click');
        expect(getTabPreference('blank')).toBeUndefined();

        second.root.remove();
        setTabPreference('pkg', 'npm');
        setTabPreference('pkg', 'pnpm');
    });
});
