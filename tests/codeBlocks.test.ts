// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
    HLJS_THEME_BASIS,
    applyCodeThemeVariables,
    bindCodeTheme,
    createCodeActionControls,
    enhanceCodeBlocks,
    ensureHljsThemeStylesheet,
    getPrettyLanguage,
    getRawLanguage,
    isShellLanguage,
    isShellScript,
    nextCodeScope,
    refreshCodeBlockPrefs,
    registerPrefsListener,
    resolveHljsTheme,
    splitHighlightedHtmlLines
} from '../packages/mdrs/dom/src/codeBlocks.ts';
import { codeBlockPrefsStore } from '../packages/mdrs/dom/src/codeBlockPrefsStore.svelte.ts';
import { readingModeStore } from '../packages/ui/src/stores/readingModeStore.svelte.ts';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const fire = (node: Element | Document, type: string) =>
    node.dispatchEvent(new window.Event(type, { bubbles: true }));

let written: string[] = [];
let clipboardFails = false;
let unsubscribe = () => {};

beforeEach(() => {
    document.documentElement.className = '';
    document.body.innerHTML = '';
    written = [];
    clipboardFails = false;
    codeBlockPrefsStore.apply({
        colorScheme: 'auto',
        lineNumbers: true,
        wrap: false,
        minimal: false
    });
    readingModeStore.disable();
    unsubscribe = codeBlockPrefsStore.subscribe(refreshCodeBlockPrefs);
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: async (text: string) => {
                if (clipboardFails) throw new Error('denied');
                written.push(text);
            }
        }
    });
    URL.createObjectURL = () => 'blob:code';
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = () => {};
});

afterEach(() => {
    unsubscribe();
    readingModeStore.disable();
});

describe('language helpers', () => {
    test('reads the language from a class name', () => {
        expect(getRawLanguage('')).toBe('');
        expect(getRawLanguage('hljs')).toBe('');
        expect(getRawLanguage('hljs language-TypeScript')).toBe('typescript');
    });

    test('names languages for display', () => {
        expect(getPrettyLanguage('')).toBe('Code');
        expect(getPrettyLanguage('language-typescript')).toBe('TypeScript');
        expect(getPrettyLanguage('language-zzzlang')).toBe('Zzzlang');
    });

    test('detects shell languages and scripts', () => {
        expect(isShellLanguage(' Bash ')).toBe(true);
        expect(isShellLanguage('rust')).toBe(false);
        expect(isShellScript('#!/bin/sh\nls')).toBe(true);
        expect(isShellScript('if true; then echo; fi')).toBe(true);
        expect(isShellScript('build() {\n  ls\n}')).toBe(true);
        expect(isShellScript('ls -la')).toBe(false);
    });

    test('resolves the highlight theme', () => {
        expect(resolveHljsTheme(true, 'auto')).toBe('dark');
        expect(resolveHljsTheme(false, 'auto')).toBe('light');
        expect(resolveHljsTheme(false, 'dark')).toBe('dark');
        expect(resolveHljsTheme(true, 'light')).toBe('light');
    });

    test('numbers scopes', () => {
        const first = nextCodeScope('code');
        const second = nextCodeScope('code');
        expect(first).not.toBe(second);
        expect(second.startsWith('code-')).toBe(true);
    });

    test('splits highlighted html across lines', () => {
        const lines = splitHighlightedHtmlLines(
            '<span class="a">one\ntwo</span>\n\r\nthree<br/>\r<i>x</i>'
        );
        expect(lines[0]).toBe('<span class="a">one</span>');
        expect(lines[1]).toBe('<span class="a">two</span>');
        expect(lines[2]).toBe('&nbsp;');
        expect(lines.length).toBe(5);
    });
});

describe('theme stylesheet', () => {
    test('reports unknown themes and failing stylesheet imports', async () => {
        const original = console.error;
        const errors: unknown[] = [];
        console.error = (...args: unknown[]) => void errors.push(args);
        const basis = { ...HLJS_THEME_BASIS };
        HLJS_THEME_BASIS.light = 'missing-theme';
        await ensureHljsThemeStylesheet('light');
        Object.assign(HLJS_THEME_BASIS, basis);
        mock.module('highlight.js/styles/github-dark.css?url', () => {
            throw new Error('no stylesheet');
        });
        await ensureHljsThemeStylesheet('dark');
        console.error = original;
        expect(errors.length).toBe(2);
        mock.module('highlight.js/styles/github-dark.css?url', () => ({ default: '/dark.css' }));
    });

    test('loads each theme once and handles sequential and failing loads', async () => {
        const first = ensureHljsThemeStylesheet('light');
        const again = ensureHljsThemeStylesheet('light');
        expect(again).toBe(first);
        const link = document.head.querySelector('link[rel="stylesheet"]') as HTMLLinkElement;
        await flush();
        if (link) fire(link, 'load');
        await first;
        await ensureHljsThemeStylesheet('light');

        const dark = ensureHljsThemeStylesheet('dark');
        await flush();
        const shared = document.head.querySelector('link[rel="stylesheet"]') as HTMLLinkElement;
        fire(shared, 'error');
        await dark;
        const retry = ensureHljsThemeStylesheet('dark');
        await flush();
        fire(shared, 'load');
        await retry;
        await ensureHljsThemeStylesheet('dark');
    });

    test('supersedes an in-flight load with the newer request', async () => {
        const stale = ensureHljsThemeStylesheet('light');
        const next = ensureHljsThemeStylesheet('dark');
        await flush();
        const link = document.head.querySelector('link[rel="stylesheet"]') as HTMLLinkElement;
        fire(link, 'load');
        await Promise.all([stale, next]);
    });
});

describe('applyCodeThemeVariables', () => {
    test('derives theme variables for light and dark hosts', () => {
        const source = document.createElement('div');
        const scoped = document.createElement('div');
        const target = document.createElement('div');
        scoped.appendChild(target);
        document.body.append(source, scoped);

        applyCodeThemeVariables(target, source);
        expect(target.style.getPropertyValue('--code-theme-border')).toContain('20%');

        document.documentElement.classList.add('dark');
        applyCodeThemeVariables(target, source);
        expect(target.style.getPropertyValue('--code-theme-border')).toContain('18%');

        scoped.dataset.mdrsCodeTheme = 'light';
        applyCodeThemeVariables(target, source);
        expect(target.style.getPropertyValue('--code-theme-border')).toContain('20%');

        scoped.dataset.mdrsCodeTheme = 'dark';
        document.documentElement.classList.remove('dark');
        applyCodeThemeVariables(target, source);
        expect(target.style.getPropertyValue('--code-theme-border')).toContain('18%');

        delete scoped.dataset.mdrsCodeTheme;
        scoped.dataset.codeTheme = 'dark';
        applyCodeThemeVariables(target, source);
        expect(target.style.getPropertyValue('--code-theme-border')).toContain('18%');
    });
});

describe('preference listeners', () => {
    test('prunes detached blocks and applies the rest', () => {
        const attached = document.createElement('div');
        const detached = document.createElement('div');
        document.body.appendChild(attached);
        let attachedCalls = 0;
        let detachedCalls = 0;
        let freeCalls = 0;
        registerPrefsListener(() => attachedCalls++, attached);
        registerPrefsListener(() => detachedCalls++, detached);
        registerPrefsListener(() => freeCalls++);
        refreshCodeBlockPrefs();
        refreshCodeBlockPrefs();
        expect(attachedCalls).toBe(2);
        expect(detachedCalls).toBe(0);
        expect(freeCalls).toBe(2);
    });

    test('binds a container to the code theme', async () => {
        const container = document.createElement('div');
        const body = document.createElement('div');
        const extra = document.createElement('div');
        document.body.append(container, body, extra);
        bindCodeTheme(container, body, [extra]);
        expect(container.getAttribute('data-mdrs-code-theme')).toBe('light');
        document.documentElement.classList.add('dark');
        refreshCodeBlockPrefs();
        expect(extra.getAttribute('data-mdrs-code-theme')).toBe('dark');
        await flush();
    });

    test('reacts to site theme changes while the scheme is auto', async () => {
        const container = document.createElement('div');
        const body = document.createElement('div');
        document.body.append(container, body);
        bindCodeTheme(container, body, []);
        document.documentElement.classList.add('dark');
        await flush();
        expect(container.getAttribute('data-mdrs-code-theme')).toBe('dark');
        codeBlockPrefsStore.setColorScheme('light');
        document.documentElement.classList.remove('dark');
        await flush();
        expect(container.getAttribute('data-mdrs-code-theme')).toBe('light');
    });
});

function controls(options: Partial<Parameters<typeof createCodeActionControls>[0]> = {}) {
    const toasts: string[] = [];
    const result = createCodeActionControls({
        getCodeText: () => 'echo hi',
        triggerToast: message => toasts.push(message),
        ...options
    });
    document.body.appendChild(result.controls);
    return { ...result, toasts };
}

describe('createCodeActionControls', () => {
    test('copies code and reports failures', async () => {
        const { controls: root, toasts } = controls();
        const copy = root.querySelector('button[aria-label="Copy code"]')!;
        fire(copy, 'click');
        await flush();
        expect(written).toEqual(['echo hi']);
        expect(toasts).toEqual(['Copied!']);
        expect(copy.innerHTML).toContain('copy-check');
        await new Promise(resolve => setTimeout(resolve, 2050));
        expect(copy.innerHTML).not.toContain('copy-check');

        clipboardFails = true;
        const original = console.error;
        console.error = () => {};
        fire(copy, 'click');
        await flush();
        console.error = original;
        expect(toasts).toEqual(['Copied!']);
    });

    test('does not copy empty code', async () => {
        const { controls: root } = controls({ getCodeText: () => '' });
        fire(root.querySelector('button[aria-label="Copy code"]')!, 'click');
        await flush();
        expect(written).toEqual([]);
    });

    test('cycles the color scheme after the icon animation', () => {
        const { controls: root } = controls();
        const toggle = root.querySelector('.mdrs-code-theme-icon')!.parentElement!;
        const stage = root.querySelector('.mdrs-code-theme-icon')!;
        fire(toggle, 'click');
        expect(stage.classList.contains('mdrs-code-icon-out')).toBe(true);
        fire(stage, 'animationend');
        expect(codeBlockPrefsStore.current.colorScheme).toBe('light');
        expect(stage.classList.contains('mdrs-code-icon-in')).toBe(true);
        fire(stage, 'animationend');
        expect(stage.classList.contains('mdrs-code-icon-in')).toBe(false);
    });

    test('toggles the menu and closes it on outside clicks', () => {
        const { controls: root } = controls();
        const kebab = root.querySelector('button[aria-haspopup="true"]')!;
        const panel = root.querySelector('.mdrs-code-menu')!;
        fire(kebab, 'click');
        expect(panel.classList.contains('mdrs-is-open')).toBe(true);
        expect(kebab.getAttribute('aria-expanded')).toBe('true');
        fire(kebab, 'click');
        expect(panel.classList.contains('mdrs-is-open')).toBe(false);
        fire(kebab, 'click');
        fire(panel, 'click');
        fire(document.body, 'click');
        expect(panel.classList.contains('mdrs-is-open')).toBe(false);
    });

    test('stops listening once detached', () => {
        const { controls: root } = controls();
        root.remove();
        fire(document.body, 'click');
        fire(document.body, 'click');
    });

    test('toggles preferences from the menu rows', () => {
        const { controls: root } = controls();
        const [lines, wrap, clean] = [...root.querySelectorAll('[role="menuitemcheckbox"]')];
        fire(lines, 'click');
        expect(codeBlockPrefsStore.current.lineNumbers).toBe(false);
        fire(wrap, 'click');
        expect(codeBlockPrefsStore.current.wrap).toBe(true);
        fire(root.querySelector('button[aria-haspopup="true"]')!, 'click');
        fire(clean, 'click');
        expect(codeBlockPrefsStore.current.minimal).toBe(true);
        const exit = root.querySelector('button[aria-label="Exit clean mode"]')!;
        fire(exit, 'click');
        expect(codeBlockPrefsStore.current.minimal).toBe(false);
        fire(root.querySelector('button[aria-label="Code block options"]')!, 'click');
    });

    test('downloads with the default and a custom filename', () => {
        const first = controls();
        const download = first.controls.querySelector('[role="menuitem"]')!;
        fire(download, 'click');
        expect(first.toasts).toEqual(['Downloaded snippet.txt']);

        const second = controls({ getDownloadFilename: () => 'main.rs' });
        fire(second.controls.querySelector('[role="menuitem"]')!, 'click');
        expect(second.toasts).toEqual(['Downloaded main.rs']);

        const empty = controls({ getCodeText: () => '' });
        fire(empty.controls.querySelector('[role="menuitem"]')!, 'click');
        expect(empty.toasts).toEqual([]);
    });

    test('delegates downloads to the caller', () => {
        let downloads = 0;
        const { controls: root } = controls({
            onDownload: () => downloads++,
            downloadLabel: 'Save'
        });
        const link = root.querySelector('[role="menuitem"]')!;
        expect(link.textContent).toContain('Save');
        fire(link, 'click');
        expect(downloads).toBe(1);
    });

    test('hides line numbers when asked and in reading mode', () => {
        const hidden = controls({ shouldHideLineNumbers: () => true });
        expect(hidden.controls.querySelectorAll('[role="menuitemcheckbox"]').length).toBe(2);
        hidden.applyPrefs();

        const shown = controls({ shouldHideLineNumbers: () => false });
        expect(shown.controls.querySelectorAll('[role="menuitemcheckbox"]').length).toBe(3);

        readingModeStore.enable();
        shown.applyPrefs();
        expect(
            (shown.controls.querySelector('.mdrs-code-action:last-of-type') as HTMLElement).style
                .display
        ).toBe('none');
        readingModeStore.disable();
        codeBlockPrefsStore.setMinimal(true);
        shown.applyPrefs();
        shown.setMinimalMode(false);
        shown.syncKebabTheme('dark');
    });

    test('binds shortcuts when a scope is given', async () => {
        const { controls: root } = controls({ shortcutScope: 'code-test' });
        await flush();
        expect(root.querySelectorAll('button').length).toBeGreaterThan(3);
        const lazy = controls({ shortcutScope: 'code-lazy' });
        lazy.controls.remove();
        await flush();
    });
});

function codeBlock(options: {
    language?: string;
    text?: string;
    html?: string;
    filename?: string;
    marks?: string;
    tabs?: boolean;
    bare?: boolean;
}) {
    const wrapper = document.createElement('div');
    if (options.tabs) wrapper.className = 'mdrs-snippets';
    if (options.tabs) {
        const header = document.createElement('div');
        header.className = 'mdrs-snippets-header';
        wrapper.appendChild(header);
    }
    const pre = document.createElement('pre');
    if (options.filename) pre.dataset.mdrsFilename = options.filename;
    if (options.marks) pre.dataset.mdrsHighlightLines = options.marks;
    if (!options.bare) {
        const code = document.createElement('code');
        if (options.language) code.className = `hljs language-${options.language}`;
        if (options.html !== undefined) code.innerHTML = options.html;
        else code.textContent = options.text ?? 'one\ntwo\n';
        pre.appendChild(code);
    }
    wrapper.appendChild(pre);
    document.body.appendChild(wrapper);
    return { wrapper, pre };
}

describe('enhanceCodeBlocks', () => {
    test('wraps plain, command, script, tabbed and bare blocks', async () => {
        const plain = codeBlock({
            language: 'typescript',
            text: 'const a = 1;\nconst b = 2;\n',
            filename: 'main.ts',
            marks: '1,x,0,2'
        });
        const command = codeBlock({ language: 'bash', text: 'ls -la\n' });
        const script = codeBlock({ language: 'bash', text: '#!/bin/sh\nls\n' });
        const single = codeBlock({ language: 'rust', text: 'fn main() {}' });
        const tabbed = codeBlock({ language: 'js', text: 'a\nb', tabs: true, filename: 'x.js' });
        const tabbedPlain = codeBlock({ text: 'a', tabs: true });
        const bare = codeBlock({ bare: true });
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: { ready: Promise.resolve() }
        });
        const spanned = codeBlock({ language: 'xml', html: '<span class="k">a\nb</span>\n' });
        const toasts: string[] = [];
        enhanceCodeBlocks(message => toasts.push(message));
        enhanceCodeBlocks(message => toasts.push(message));
        await flush();

        expect(plain.wrapper.querySelector('.mdrs-code-filename')?.textContent).toBe('main.ts');
        expect(plain.wrapper.querySelectorAll('.mdrs-code-line--marked').length).toBe(2);
        expect(command.wrapper.querySelector('.mdrs-code-prompt')?.textContent).toBe('$');
        expect(script.wrapper.querySelector('.mdrs-code-prompt')).toBeNull();
        expect(single.wrapper.querySelectorAll('.mdrs-code-line').length).toBe(1);
        expect(tabbed.wrapper.querySelector('.mdrs-code-badge')?.textContent).toBe('x.js · js');
        expect(tabbedPlain.wrapper.querySelector('.mdrs-code-badge')).toBeNull();
        expect(bare.wrapper.querySelector('.mdrs-code-gutter')).toBeNull();
        expect(spanned.wrapper.querySelectorAll('.mdrs-code-line').length).toBe(2);
        fire(plain.wrapper.querySelector('[role="menuitem"]')!, 'click');
        expect(toasts).toContain('Downloaded main.ts');
        fire(single.wrapper.querySelector('[role="menuitem"]')!, 'click');
        expect(toasts).toContain('Downloaded snippet.rs');
    });

    test('reacts to every preference combination', async () => {
        const plain = codeBlock({ language: 'typescript', text: 'a\nb' });
        const one = codeBlock({ language: 'typescript', text: 'a' });
        const command = codeBlock({ language: 'sh', text: 'ls' });
        const tabbed = codeBlock({ language: 'js', text: 'a', tabs: true });
        const bare = codeBlock({ bare: true });
        enhanceCodeBlocks(() => {});
        await flush();

        const gutters = () =>
            [...document.querySelectorAll<HTMLElement>('.mdrs-code-gutter')].map(
                gutter => gutter.style.display
            );

        codeBlockPrefsStore.setLineNumbers(false);
        expect(gutters()).toContain('none');
        codeBlockPrefsStore.setLineNumbers(true);
        codeBlockPrefsStore.setWrap(true);
        expect(plain.pre.dataset.mdrsWrap).toBe('true');
        codeBlockPrefsStore.setWrap(false);
        expect(plain.pre.dataset.mdrsWrap).toBeUndefined();
        codeBlockPrefsStore.setMinimal(true);
        expect(gutters()).toContain('none');
        expect(one.wrapper.querySelector('.mdrs-code-header--centered')).not.toBeNull();
        readingModeStore.enable();
        refreshCodeBlockPrefs();
        readingModeStore.disable();
        codeBlockPrefsStore.setMinimal(false);
        codeBlockPrefsStore.setColorScheme('dark');
        expect(
            plain.wrapper.querySelector('.mdrs-code')?.getAttribute('data-mdrs-code-theme')
        ).toBe('dark');
        expect(tabbed.wrapper.getAttribute('data-mdrs-code-theme')).toBe('dark');
        expect(
            tabbed.wrapper
                .querySelector('.mdrs-snippets-header')
                ?.getAttribute('data-mdrs-code-theme')
        ).toBe('dark');
        document.documentElement.classList.add('dark');
        codeBlockPrefsStore.setColorScheme('auto');
        expect(
            command.wrapper.querySelector('.mdrs-code')?.getAttribute('data-mdrs-code-theme')
        ).toBe('dark');
        void bare;
        await flush();
    });

    test('syncs gutter heights while wrapping', async () => {
        const block = codeBlock({ language: 'typescript', text: 'a\nb\nc' });
        enhanceCodeBlocks(() => {});
        codeBlockPrefsStore.setWrap(true);
        for (const line of block.pre.querySelectorAll<HTMLElement>('.mdrs-code-line'))
            line.getBoundingClientRect = () => ({ height: 21 }) as DOMRect;
        codeBlockPrefsStore.setWrap(false);
        codeBlockPrefsStore.setWrap(true);
        await flush();
        await new Promise(resolve => setTimeout(resolve, 60));
        document.body.removeChild(block.wrapper);
        refreshCodeBlockPrefs();
    });

    test('limits enhancement to a container', () => {
        const inside = codeBlock({ language: 'js', text: 'a' });
        const outside = codeBlock({ language: 'js', text: 'b' });
        enhanceCodeBlocks(() => {}, inside.wrapper);
        expect(inside.pre.dataset.mdrsEnhanced).toBe('true');
        expect(outside.pre.dataset.mdrsEnhanced).toBeUndefined();
        enhanceCodeBlocks(() => {}, outside.wrapper);
        outside.wrapper.remove();
        enhanceCodeBlocks(() => {});
    });
});
