import hljs from 'highlight.js';
import { codeBlockPrefsStore } from '../stores/codeBlockPrefsStore.svelte';
import { readingModeStore } from '../stores/readingModeStore.svelte';
import { getDownloadFilename, sanitizeFilename } from './codeBlockExtensions';
import { cn } from './cn';
import { createCodeScrollbar } from './codeScrollbar';
import { shortcut, type ShortcutParams } from './shortcut.svelte';
import { focusScope } from './focusScope';
import { argKey } from '#lib/shortcuts.ts';

let codeScopeSeq = 0;

export function nextCodeScope(prefix: string) {
    return `${prefix}-${++codeScopeSeq}`;
}

export type CodeColorScheme = 'auto' | 'light' | 'dark';

export const HLJS_THEME_BASIS: Record<'light' | 'dark', string> = {
    light: 'github',
    dark: 'github-dark'
};

export function resolveHljsTheme(
    siteIsDark: boolean,
    colorScheme: CodeColorScheme
): 'light' | 'dark' {
    const isDark = colorScheme === 'auto' ? siteIsDark : colorScheme === 'dark';
    return isDark ? 'dark' : 'light';
}

const hljsThemeStylesheets: Record<string, () => Promise<string>> = {
    github: () => import('highlight.js/styles/github.css?url').then(m => m.default),
    'github-dark': () => import('highlight.js/styles/github-dark.css?url').then(m => m.default)
};

let hljsThemeLink: HTMLLinkElement | null = null;
let loadedHljsThemeName: string | null = null;
let loadingHljsThemeName: string | null = null;
let loadingHljsTheme: Promise<void> | null = null;
let hljsThemeRequestId = 0;

export function ensureHljsThemeStylesheet(effectiveTheme: 'light' | 'dark'): Promise<void> {
    const themeName = HLJS_THEME_BASIS[effectiveTheme];
    if (themeName === loadedHljsThemeName) return Promise.resolve();
    if (themeName === loadingHljsThemeName && loadingHljsTheme) {
        return loadingHljsTheme;
    }

    const loadUrl = hljsThemeStylesheets[themeName];
    if (!loadUrl) {
        console.error(`Unknown highlight.js theme: "${themeName}"`);
        return Promise.resolve();
    }

    loadingHljsThemeName = themeName;
    const requestId = ++hljsThemeRequestId;
    loadingHljsTheme = loadUrl().then(
        href =>
            new Promise<void>(resolve => {
                if (!hljsThemeLink) {
                    hljsThemeLink = document.createElement('link');
                    hljsThemeLink.rel = 'stylesheet';
                    document.head.appendChild(hljsThemeLink);
                }
                hljsThemeLink.addEventListener(
                    'load',
                    () => {
                        if (requestId === hljsThemeRequestId) {
                            loadedHljsThemeName = themeName;
                            loadingHljsThemeName = null;
                            loadingHljsTheme = null;
                            refreshCodeBlockPrefs();
                        }
                        resolve();
                    },
                    { once: true }
                );
                hljsThemeLink.href = href;
            })
    );
    return loadingHljsTheme;
}

export function applyCodeThemeVariables(target: HTMLElement, source: HTMLElement) {
    const themeStyles = getComputedStyle(source);
    const themeBackground = themeStyles.backgroundColor;
    const themeForeground = themeStyles.color;
    target.style.setProperty('--code-theme-bg', themeBackground);
    target.style.setProperty('--code-theme-fg', themeForeground);
    target.style.setProperty(
        '--code-theme-muted',
        `color-mix(in srgb, ${themeForeground} 60%, ${themeBackground})`
    );

    const themed = target.closest<HTMLElement>('[data-mdrs-code-theme], [data-code-theme]');
    const theme = themed?.dataset.mdrsCodeTheme ?? themed?.dataset.codeTheme;
    const isDark =
        theme === 'dark'
        || (theme !== 'light'
            && typeof document !== 'undefined'
            && document.documentElement.classList.contains('dark'));

    target.style.setProperty(
        '--code-theme-border',
        isDark ?
            `color-mix(in srgb, ${themeForeground} 18%, ${themeBackground})`
        :   `color-mix(in srgb, ${themeForeground} 20%, ${themeBackground})`
    );
}

const SHELL_LANGUAGES = new Set([
    'sh',
    'bash',
    'zsh',
    'fish',
    'shell',
    'nu',
    'nushell',
    'powershell',
    'ps1',
    'cmd',
    'bat',
    'terminal',
    'console'
]);

export function getRawLanguage(className: string): string {
    if (!className) return '';
    const match = className.match(/language-(\S+)/);
    return match ? match[1].toLowerCase() : '';
}

export function isShellLanguage(lang: string): boolean {
    return SHELL_LANGUAGES.has(lang.toLowerCase().trim());
}

export function isShellScript(code: string): boolean {
    const trimmed = code.trim();
    if (/^#!\s*\//m.test(trimmed)) return true;
    if (
        /\b(if\s|then\b|elif\s|else\b|fi\b|for\s|while\s|until\s|do\b|done\b|case\s|esac\b|function\s)/m.test(
            trimmed
        )
    ) {
        return true;
    }
    if (/^[a-zA-Z_0-9-]+\s*\(\)\s*\{/m.test(trimmed)) return true;
    return false;
}

export function getPrettyLanguage(className: string): string {
    const lang = getRawLanguage(className);
    if (!lang) return 'Code';
    return hljs.getLanguage(lang)?.name ?? lang.charAt(0).toUpperCase() + lang.slice(1);
}

export function splitHighlightedHtmlLines(html: string): string[] {
    const lines = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const result: string[] = [];
    let openTags: string[] = [];

    for (const line of lines) {
        const prefix = openTags.join('');
        const tagRegex = /<\/?([a-z0-9]+)[^>]*>/gi;
        let match: RegExpExecArray | null;
        const currentOpen = [...openTags];

        while ((match = tagRegex.exec(line)) !== null) {
            const fullTag = match[0];
            if (fullTag.startsWith('</')) {
                currentOpen.pop();
            } else if (!fullTag.endsWith('/>')) {
                currentOpen.push(fullTag);
            }
        }

        const suffix = currentOpen
            .slice()
            .reverse()
            .map(t => {
                const name = t.match(/<([a-z0-9]+)/i)?.[1];
                return name ? `</${name}>` : '';
            })
            .join('');

        const content = line || '&nbsp;';
        result.push(prefix + content + suffix);
        openTags = currentOpen;
    }

    return result;
}

export const CODE_ICON_BUTTON_CLASS = 'mdrs-code-button';

const HEADER_BAR_CLASS = 'mdrs-code-header hljs';

const HEADER_BAR_MINIMAL_CLASS = 'mdrs-code-header mdrs-code-header--minimal hljs';

const HEADER_BAR_MINIMAL_CENTERED_CLASS =
    'mdrs-code-header mdrs-code-header--minimal mdrs-code-header--centered hljs';

const ACTION_WRAPPER_CLASS = 'mdrs-code-action';

const ICONS = {
    copy: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    copyCheck:
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-copy-check mdrs-is-done"><path d="m12 15 2 2 4-4"/><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    sun: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    moon: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-moon"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>',
    sunMoon:
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-sun-moon"><path d="M12 2v2"/><path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715"/><path d="M16 12a4 4 0 0 0-4-4"/><path d="m19 5-1.256 1.256"/><path d="M20 12h2"/></svg>',
    kebab: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-ellipsis-vertical"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
    unfoldVertical:
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-unfold-vertical"><path d="M12 22v-6"/><path d="M12 8V2"/><path d="M4 12H2"/><path d="M10 12H8"/><path d="M16 12h-2"/><path d="M22 12h-2"/><path d="m15 19-3 3-3-3"/><path d="m15 5-3-3-3 3"/></svg>',
    download:
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-download"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-check"><path d="M20 6 9 17l-5-5"/></svg>',
    squareOutline:
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-square"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>',
    squareCheck:
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mdrs-icon mdrs-icon-square-check"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>'
};

const THEME_ICONS: Record<CodeColorScheme, string> = {
    auto: ICONS.sunMoon,
    light: ICONS.sun,
    dark: ICONS.moon
};

const THEME_LABELS: Record<CodeColorScheme, string> = {
    auto: 'Auto',
    light: 'Light',
    dark: 'Dark'
};

interface EnhancedBlock {
    pre?: HTMLElement;
    applyPrefs: () => void;
}

const enhancedBlocks: EnhancedBlock[] = [];
let siteThemeObserverAttached = false;

export function registerPrefsListener(applyPrefs: () => void, targetElement?: HTMLElement) {
    enhancedBlocks.push({ applyPrefs, pre: targetElement });
}

export function refreshCodeBlockPrefs() {
    for (let i = enhancedBlocks.length - 1; i >= 0; i--) {
        const block = enhancedBlocks[i];
        if (block.pre && !document.contains(block.pre)) {
            enhancedBlocks.splice(i, 1);
            continue;
        }
        block.applyPrefs();
    }
}

export function bindCodeTheme(container: HTMLElement, body: HTMLElement, themed: HTMLElement[]) {
    ensureSiteThemeObserver();
    const apply = () => {
        const effectiveTheme = resolveHljsTheme(
            document.documentElement.classList.contains('dark'),
            codeBlockPrefsStore.current.colorScheme
        );
        for (const element of [container, body, ...themed])
            element.setAttribute('data-mdrs-code-theme', effectiveTheme);
        applyCodeThemeVariables(container, body);
        ensureHljsThemeStylesheet(effectiveTheme).then(() =>
            applyCodeThemeVariables(container, body)
        );
    };
    apply();
    registerPrefsListener(apply, container);
}

function ensureSiteThemeObserver() {
    if (siteThemeObserverAttached) return;
    siteThemeObserverAttached = true;

    const observer = new MutationObserver(() => {
        if (codeBlockPrefsStore.current.colorScheme === 'auto') {
            refreshCodeBlockPrefs();
        }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

function buildMenuCheckboxRow(label: string, getChecked: () => boolean, onToggle: () => void) {
    const row = document.createElement('button');
    row.type = 'button';
    row.setAttribute('role', 'menuitemcheckbox');
    row.className = 'mdrs-code-menu-item';

    const box = document.createElement('span');
    const labelEl = document.createElement('span');
    labelEl.textContent = label;

    row.appendChild(box);
    row.appendChild(labelEl);

    function sync() {
        const checked = getChecked();
        row.setAttribute('aria-checked', String(checked));
        box.innerHTML = checked ? ICONS.squareCheck : ICONS.squareOutline;
        box.className = cn('mdrs-code-menu-check', checked && 'mdrs-is-checked');
    }

    row.addEventListener('click', () => {
        onToggle();
        refreshCodeBlockPrefs();
    });

    sync();
    return { row, sync };
}

export interface CodeActionControlsOptions {
    getCodeText: () => string;
    getDownloadFilename?: () => string;
    downloadLabel?: string;
    onDownload?: () => void;
    shouldHideLineNumbers?: () => boolean;
    triggerToast: (message: string) => void;
    shortcutScope?: string;
}

export interface CodeActionControlsResult {
    controls: HTMLElement;
    applyPrefs: () => void;
    setMinimalMode: (isMinimal: boolean) => void;
    syncKebabTheme: (theme: 'light' | 'dark') => void;
}

export function createCodeActionControls(
    options: CodeActionControlsOptions
): CodeActionControlsResult {
    const {
        getCodeText,
        getDownloadFilename: getFilename,
        downloadLabel = 'Download',
        onDownload,
        shouldHideLineNumbers,
        triggerToast,
        shortcutScope
    } = options;
    const controls = document.createElement('div');
    controls.className = 'mdrs-code-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = CODE_ICON_BUTTON_CLASS;
    copyBtn.setAttribute('aria-label', 'Copy code');
    copyBtn.innerHTML = ICONS.copy;

    copyBtn.addEventListener('click', () => {
        const codeText = getCodeText();
        if (!codeText) return;
        navigator.clipboard
            .writeText(codeText)
            .then(() => {
                copyBtn.innerHTML = ICONS.copyCheck;
                triggerToast('Copied!');
                setTimeout(() => {
                    copyBtn.innerHTML = ICONS.copy;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy code: ', err);
            });
    });

    const copyWrapper = document.createElement('div');
    copyWrapper.className = ACTION_WRAPPER_CLASS;
    copyWrapper.appendChild(copyBtn);
    controls.appendChild(copyWrapper);

    const themeToggleBtn = document.createElement('button');
    themeToggleBtn.type = 'button';
    themeToggleBtn.className = CODE_ICON_BUTTON_CLASS;
    const themeIconStage = document.createElement('span');
    themeIconStage.className = 'mdrs-code-theme-icon';
    themeToggleBtn.appendChild(themeIconStage);
    controls.appendChild(themeToggleBtn);

    themeToggleBtn.addEventListener('click', () => {
        themeIconStage.classList.remove('mdrs-code-icon-in');
        themeIconStage.classList.add('mdrs-code-icon-out');

        themeIconStage.addEventListener(
            'animationend',
            () => {
                themeIconStage.classList.remove('mdrs-code-icon-out');
                codeBlockPrefsStore.cycleColorScheme();
                refreshCodeBlockPrefs();
                themeIconStage.classList.add('mdrs-code-icon-in');
                themeIconStage.addEventListener(
                    'animationend',
                    () => themeIconStage.classList.remove('mdrs-code-icon-in'),
                    { once: true }
                );
            },
            { once: true }
        );
    });

    const kebabWrapper = document.createElement('div');
    kebabWrapper.className = ACTION_WRAPPER_CLASS;
    controls.appendChild(kebabWrapper);

    const kebabBtn = document.createElement('button');
    kebabBtn.type = 'button';
    kebabBtn.className = CODE_ICON_BUTTON_CLASS;
    kebabBtn.setAttribute('aria-label', 'Code block options');
    kebabBtn.setAttribute('aria-haspopup', 'true');
    kebabBtn.setAttribute('aria-expanded', 'false');
    kebabBtn.innerHTML = ICONS.kebab;
    kebabWrapper.appendChild(kebabBtn);

    const kebabPanel = document.createElement('div');
    kebabPanel.setAttribute('role', 'menu');
    kebabPanel.className = 'mdrs-code-menu';
    kebabWrapper.appendChild(kebabPanel);

    function syncKebabTheme(theme: 'light' | 'dark') {
        kebabPanel.setAttribute('data-mdrs-code-theme', theme);
    }

    function closeKebab() {
        kebabPanel.classList.remove('mdrs-is-open');
        kebabBtn.setAttribute('aria-expanded', 'false');
        kebabWrapper.style.opacity = '';
    }

    function openKebab() {
        kebabPanel.classList.add('mdrs-is-open');
        kebabBtn.setAttribute('aria-expanded', 'true');
        kebabWrapper.style.opacity = '1';
    }

    let kebabClickHandler = (e: MouseEvent) => {
        e.stopPropagation();
        if (!kebabPanel.classList.contains('mdrs-is-open')) openKebab();
        else closeKebab();
    };
    kebabBtn.addEventListener('click', kebabClickHandler);

    document.addEventListener('click', e => {
        if (!kebabWrapper.contains(e.target as Node)) closeKebab();
    });

    const lineNumbersRow = buildMenuCheckboxRow(
        'Line numbers',
        () => codeBlockPrefsStore.current.lineNumbers,
        () => codeBlockPrefsStore.toggleLineNumbers()
    );
    const wrapRow = buildMenuCheckboxRow(
        'Wrap lines',
        () => codeBlockPrefsStore.current.wrap,
        () => codeBlockPrefsStore.toggleWrap()
    );
    const minimalRow = buildMenuCheckboxRow(
        'Clean mode',
        () => codeBlockPrefsStore.current.minimal,
        () => codeBlockPrefsStore.toggleMinimal()
    );
    minimalRow.row.addEventListener('click', () => {
        if (codeBlockPrefsStore.current.minimal) closeKebab();
    });

    const divider = document.createElement('div');
    divider.className = 'mdrs-code-menu-divider';

    const downloadRow = document.createElement('button');
    downloadRow.type = 'button';
    downloadRow.setAttribute('role', 'menuitem');
    downloadRow.className = 'mdrs-code-menu-link';
    downloadRow.innerHTML = `<span>${downloadLabel}</span><span class="mdrs-code-menu-hint">${ICONS.download}</span>`;

    downloadRow.addEventListener('click', () => {
        if (onDownload) {
            onDownload();
            closeKebab();
            return;
        }
        const code = getCodeText();
        if (!code) return;
        const filename = getFilename ? getFilename() : 'snippet.txt';
        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        closeKebab();
        triggerToast(`Downloaded ${filename}`);
    });

    if (!shouldHideLineNumbers || !shouldHideLineNumbers()) {
        kebabPanel.appendChild(lineNumbersRow.row);
    }
    kebabPanel.appendChild(wrapRow.row);
    kebabPanel.appendChild(minimalRow.row);
    kebabPanel.appendChild(divider);
    kebabPanel.appendChild(downloadRow);

    if (shortcutScope) {
        const bind = (node: HTMLElement, params: ShortcutParams) =>
            queueMicrotask(() => {
                if (node.isConnected) shortcut(node, params);
            });
        const blockKey = (
            node: HTMLElement,
            combo: string,
            label: string,
            placement: ShortcutParams['placement'] = 'overhang'
        ) => bind(node, { combo, label, scope: shortcutScope, placement });
        const prefKey = (
            node: HTMLElement,
            arg: 'theme' | 'wrap' | 'lines' | 'clean',
            label: string,
            placement: ShortcutParams['placement'] = 'inline'
        ) => bind(node, { group: 'code', chordKey: argKey('/code', arg), label, placement });
        blockKey(copyBtn, 'C', 'Copy code');
        blockKey(kebabBtn, 'O', 'Code block options');
        blockKey(downloadRow, 'D', downloadLabel, 'inline');
        prefKey(themeToggleBtn, 'theme', 'Code color scheme', 'overhang');
        prefKey(lineNumbersRow.row, 'lines', 'Line numbers');
        prefKey(wrapRow.row, 'wrap', 'Wrap lines');
        prefKey(minimalRow.row, 'clean', 'Clean mode');
    }

    function setMinimalMode(isMinimal: boolean) {
        themeToggleBtn.style.display = isMinimal ? 'none' : '';
        kebabBtn.removeEventListener('click', kebabClickHandler);
        if (isMinimal) {
            kebabBtn.innerHTML = ICONS.unfoldVertical;
            kebabBtn.setAttribute('aria-label', 'Exit clean mode');
            kebabClickHandler = (e: MouseEvent) => {
                e.stopPropagation();
                codeBlockPrefsStore.toggleMinimal();
                refreshCodeBlockPrefs();
            };
        } else {
            kebabBtn.innerHTML = ICONS.kebab;
            kebabBtn.setAttribute('aria-label', 'Code block options');
            kebabClickHandler = (e: MouseEvent) => {
                e.stopPropagation();
                if (!kebabPanel.classList.contains('mdrs-is-open')) openKebab();
                else closeKebab();
            };
        }
        kebabBtn.addEventListener('click', kebabClickHandler);
    }

    function applyPrefs() {
        const prefs = codeBlockPrefsStore.current;
        const isMinimal = readingModeStore.active || prefs.minimal;
        const effectiveColorScheme = prefs.colorScheme;
        themeIconStage.innerHTML = THEME_ICONS[effectiveColorScheme];
        themeToggleBtn.setAttribute(
            'aria-label',
            `Code color scheme: ${THEME_LABELS[effectiveColorScheme]}`
        );
        themeToggleBtn.title = `Code color scheme: ${THEME_LABELS[effectiveColorScheme]} (click to change)`;

        setMinimalMode(isMinimal);
        minimalRow.sync();

        if (readingModeStore.active) {
            kebabWrapper.style.display = 'none';
        } else {
            kebabWrapper.style.display = '';
        }

        if (isMinimal) {
            lineNumbersRow.row.style.display = 'none';
            wrapRow.row.style.display = 'none';
            divider.style.display = 'none';
            downloadRow.style.display = 'none';
        } else {
            const hideLines = options.shouldHideLineNumbers?.();
            if (hideLines) {
                lineNumbersRow.row.style.display = 'none';
            } else {
                lineNumbersRow.row.style.display = 'flex';
                lineNumbersRow.sync();
            }
            wrapRow.row.style.display = 'flex';
            wrapRow.sync();
            divider.style.display = '';
            downloadRow.style.display = 'flex';
        }
    }

    applyPrefs();
    registerPrefsListener(applyPrefs, controls);

    return { controls, applyPrefs, setMinimalMode, syncKebabTheme };
}

export function enhanceCodeBlocks(
    triggerToast: (message: string) => void,
    container: ParentNode = document
) {
    ensureSiteThemeObserver();

    for (let i = enhancedBlocks.length - 1; i >= 0; i--) {
        const block = enhancedBlocks[i];
        if (block.pre && !document.contains(block.pre)) {
            enhancedBlocks.splice(i, 1);
        }
    }

    container.querySelectorAll('pre').forEach(el => {
        const pre = el as HTMLElement;
        if (pre.dataset.mdrsEnhanced === 'true') return;
        pre.dataset.mdrsEnhanced = 'true';

        const isInsideTabs = !!pre.closest('.mdrs-snippets');
        const codeElement = pre.querySelector('code');
        const rawLang = getRawLanguage(codeElement?.className || '');
        const prettyLang = getPrettyLanguage(codeElement?.className || '');
        const customFilename = sanitizeFilename(pre.dataset.mdrsFilename);
        const rawCodeText = codeElement?.innerText || codeElement?.textContent || '';
        const isCommandBlock = isShellLanguage(rawLang) && !isShellScript(rawCodeText);

        const highlightedLines = new Set(
            (pre.dataset.mdrsHighlightLines || '')
                .split(',')
                .map(part => parseInt(part, 10))
                .filter(line => Number.isInteger(line) && line > 0)
        );

        let headerBar: HTMLElement | null = null;
        let leftSpan: HTMLElement | null = null;
        let headerControlsResult: CodeActionControlsResult | null = null;
        let lineCount = 0;
        const blockScope = isInsideTabs ? null : nextCodeScope('code');

        if (!isInsideTabs) {
            headerBar = document.createElement('div');
            headerBar.className = HEADER_BAR_CLASS;

            leftSpan = document.createElement('span');
            leftSpan.className = 'mdrs-code-meta';

            const langLabel = document.createElement('span');
            langLabel.className = 'mdrs-code-lang';
            langLabel.textContent = prettyLang;
            leftSpan.appendChild(langLabel);

            if (customFilename) {
                const fileLabel = document.createElement('span');
                fileLabel.className = 'mdrs-code-filename';
                fileLabel.textContent = customFilename;
                fileLabel.title = customFilename;
                leftSpan.appendChild(fileLabel);
            }
            headerBar.appendChild(leftSpan);

            headerControlsResult = createCodeActionControls({
                getCodeText: () => codeElement?.innerText || codeElement?.textContent || '',
                getDownloadFilename: () =>
                    getDownloadFilename(codeElement?.className || '', customFilename),
                shouldHideLineNumbers: () => isCommandBlock,
                triggerToast,
                shortcutScope: blockScope ?? undefined
            });
            headerBar.appendChild(headerControlsResult.controls);
        }

        const codeContainer = document.createElement('div');
        codeContainer.className = cn('mdrs-code', isInsideTabs && 'mdrs-code--in-tabs');

        if (isInsideTabs && rawLang) {
            const langBadge = document.createElement('span');
            langBadge.className = 'mdrs-code-badge';
            langBadge.textContent =
                customFilename ? `${customFilename} \u00b7 ${rawLang}` : rawLang;
            langBadge.title = langBadge.textContent;
            codeContainer.appendChild(langBadge);
        }

        const codeBody = document.createElement('div');
        codeBody.className = cn('mdrs-code-body hljs', isInsideTabs && 'mdrs-code-body--in-tabs');
        codeBody.style.marginTop = '0px';
        if (!isInsideTabs) {
            codeBody.style.borderTopWidth = '0px';
            codeBody.style.borderTopLeftRadius = '0px';
            codeBody.style.borderTopRightRadius = '0px';
        }

        pre.parentNode?.insertBefore(codeContainer, pre);
        if (blockScope) focusScope(codeContainer, blockScope);
        if (headerBar) codeContainer.appendChild(headerBar);
        codeContainer.appendChild(codeBody);

        let gutter: HTMLDivElement | null = null;

        if (codeElement) {
            const lines = splitHighlightedHtmlLines(codeElement.innerHTML.replace(/\n$/, ''));
            lineCount = lines.length;
            codeElement.innerHTML = lines
                .map((line, i) => {
                    const cls = cn(
                        'mdrs-code-line',
                        isCommandBlock && 'mdrs-code-line--command',
                        highlightedLines.has(i + 1) && 'mdrs-code-line--marked'
                    );
                    return `<div class="${cls}">${line}</div>`;
                })
                .join('');

            gutter = document.createElement('div');
            gutter.className = cn(
                'mdrs-code-gutter',
                isCommandBlock && 'mdrs-code-gutter--command'
            );
            lines.forEach((_, i) => {
                const num = document.createElement('div');
                if (isCommandBlock) {
                    num.className = 'mdrs-code-prompt';
                    num.textContent = '$';
                } else {
                    num.className = cn(
                        'mdrs-code-line-number',
                        highlightedLines.has(i + 1) && 'mdrs-code-line-number--marked'
                    );
                    num.textContent = String(i + 1);
                }
                gutter?.appendChild(num);
            });
            codeBody.appendChild(gutter);
        }

        pre.style.border = '0';
        pre.style.borderRadius = '0';
        pre.style.background = 'transparent';
        pre.style.margin = '0';
        pre.style.minWidth = '0';
        pre.style.paddingLeft = '0';
        pre.style.paddingRight = '0';
        pre.style.paddingTop = '0px';
        pre.style.paddingBottom = '0.375rem';
        pre.style.flex = '1 1 0%';

        codeBody.appendChild(pre);

        const syncGutterRowHeights = () => {
            if (!gutter) return;
            const gutterRowEls = [...gutter.children] as HTMLElement[];
            if (!codeBlockPrefsStore.current.wrap) {
                gutterRowEls.forEach(rowEl => {
                    rowEl.style.height = '';
                });
                return;
            }
            const codeLineEls = [...pre.querySelectorAll<HTMLElement>('.mdrs-code-line')];
            codeLineEls.forEach((lineEl, i) => {
                const rowEl = gutterRowEls[i];
                if (rowEl) rowEl.style.height = `${lineEl.getBoundingClientRect().height}px`;
            });
        };

        const scrollbar = createCodeScrollbar(pre, {
            reserve: isInsideTabs,
            bordered: !isInsideTabs,
            suppressed: () =>
                codeBlockPrefsStore.current.wrap
                || codeBlockPrefsStore.current.minimal
                || readingModeStore.active,
            onResize: syncGutterRowHeights,
            onLayout: visible => {
                codeBody.style.borderBottomLeftRadius = visible ? '0px' : '0.375rem';
                codeBody.style.borderBottomRightRadius = visible ? '0px' : '0.375rem';
                codeBody.style.borderBottomWidth = visible || isInsideTabs ? '0px' : '';
            }
        });
        const wrapperBar = scrollbar.element;
        const updateCustomScrollbar = scrollbar.update;

        codeContainer.appendChild(wrapperBar);

        function applyPrefs() {
            const prefs = codeBlockPrefsStore.current;

            const isSiteDark =
                typeof document !== 'undefined'
                && document.documentElement.classList.contains('dark');
            const effectiveTheme = resolveHljsTheme(isSiteDark, prefs.colorScheme);
            codeContainer.setAttribute('data-mdrs-code-theme', effectiveTheme);
            codeBody.setAttribute('data-mdrs-code-theme', effectiveTheme);
            wrapperBar.setAttribute('data-mdrs-code-theme', effectiveTheme);
            applyCodeThemeVariables(codeContainer, codeBody);

            const tabContainer = pre.closest<HTMLElement>('.mdrs-snippets');
            if (tabContainer) {
                tabContainer.setAttribute('data-mdrs-code-theme', effectiveTheme);
                applyCodeThemeVariables(tabContainer, codeBody);
                const tabHeader = tabContainer.querySelector<HTMLElement>('.mdrs-snippets-header');
                if (tabHeader) {
                    tabHeader.setAttribute('data-mdrs-code-theme', effectiveTheme);
                }
            }

            ensureHljsThemeStylesheet(effectiveTheme).then(() => {
                applyCodeThemeVariables(codeContainer, codeBody);
                if (tabContainer) {
                    applyCodeThemeVariables(tabContainer, codeBody);
                }
            });

            if (headerControlsResult) {
                headerControlsResult.applyPrefs();
                headerControlsResult.syncKebabTheme(effectiveTheme);
            }

            const isMinimal = readingModeStore.active || prefs.minimal;

            if (!isInsideTabs && headerBar && leftSpan) {
                headerBar.setAttribute('data-mdrs-code-theme', effectiveTheme);
                if (isMinimal) {
                    headerBar.className =
                        lineCount === 1 ?
                            HEADER_BAR_MINIMAL_CENTERED_CLASS
                        :   HEADER_BAR_MINIMAL_CLASS;
                    leftSpan.style.display = 'none';
                    codeBody.style.borderTopWidth = '1px';
                    codeBody.style.borderTopLeftRadius = '0.375rem';
                    codeBody.style.borderTopRightRadius = '0.375rem';
                } else {
                    headerBar.className = HEADER_BAR_CLASS;
                    leftSpan.style.display = '';
                    codeBody.style.borderTopWidth = '0px';
                    codeBody.style.borderTopLeftRadius = '0px';
                    codeBody.style.borderTopRightRadius = '0px';
                }
            }

            if (gutter) {
                if (isMinimal) {
                    if (isCommandBlock) {
                        gutter.style.display = '';
                    } else {
                        gutter.style.display = 'none';
                    }
                } else if (isCommandBlock) {
                    gutter.style.display = 'block';
                } else {
                    gutter.style.display = prefs.lineNumbers ? '' : 'none';
                }
            }

            if (codeElement) {
                if (prefs.wrap) {
                    pre.dataset.mdrsWrap = 'true';
                    pre.style.whiteSpace = 'pre-wrap';
                    pre.style.overflowX = 'hidden';
                    pre.style.wordBreak = 'break-word';
                    pre.style.overflowWrap = 'anywhere';
                    codeElement.style.whiteSpace = 'pre-wrap';
                    codeElement.style.wordBreak = 'break-word';
                    codeElement.style.overflowWrap = 'anywhere';
                    codeElement.style.display = 'block';
                    codeElement.style.width = '100%';
                } else {
                    pre.style.removeProperty('white-space');
                    pre.style.removeProperty('overflow-x');
                    pre.style.removeProperty('word-break');
                    pre.style.removeProperty('overflow-wrap');
                    codeElement.style.removeProperty('white-space');
                    codeElement.style.removeProperty('display');
                    codeElement.style.removeProperty('width');
                    codeElement.style.removeProperty('word-break');
                    codeElement.style.removeProperty('overflow-wrap');
                    pre.removeAttribute('data-mdrs-wrap');
                }
            }

            syncGutterRowHeights();
            updateCustomScrollbar();
        }

        applyPrefs();
        if (typeof document !== 'undefined' && document.fonts?.ready) {
            document.fonts.ready.then(() => {
                syncGutterRowHeights();
                updateCustomScrollbar();
            });
        }
        setTimeout(updateCustomScrollbar, 50);

        enhancedBlocks.push({ pre, applyPrefs });
    });
}
