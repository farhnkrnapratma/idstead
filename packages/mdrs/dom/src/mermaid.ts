// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { themeToken, type EffectiveTheme } from '@idstead/ui/themeColors.ts';

let mermaidInstance: typeof import('mermaid').default | null = null;
let themeObserverInitialized = false;

export async function getMermaid(isDark = true) {
    if (!mermaidInstance) {
        const mod = await import('mermaid');
        mermaidInstance = mod.default;
    }

    mermaidInstance.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: mermaidTheme(isDark ? 'dark' : 'light')
    });

    return mermaidInstance;
}

function sansFontFamily() {
    if (typeof document === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim();
}

function mermaidTheme(theme: EffectiveTheme) {
    const color = (name: string) => themeToken(`--color-${name}`, theme);
    const node = color('surface-subtle');
    const border = color('line-strong');
    const text = color('fg');
    const accent = color('accent');
    const label = color('on-accent');
    const series = [accent, color('discovery'), color('warning'), color('danger')];
    return {
        darkMode: theme === 'dark',
        background: 'transparent',
        mainBkg: node,
        nodeBkg: node,
        nodeBorder: border,
        nodeTextColor: text,
        titleColor: text,
        edgeLabelBackground: color('surface'),
        textColor: text,
        lineColor: accent,
        primaryColor: accent,
        primaryTextColor: label,
        primaryBorderColor: color('accent-strong'),
        secondaryColor: color('canvas'),
        secondaryTextColor: text,
        secondaryBorderColor: border,
        tertiaryColor: color('surface'),
        tertiaryTextColor: text,
        tertiaryBorderColor: border,
        actorBkg: node,
        actorBorder: border,
        actorTextColor: text,
        actorLineColor: color('fg-muted'),
        signalColor: accent,
        signalTextColor: text,
        labelBoxBkgColor: node,
        labelBoxBorderColor: border,
        labelTextColor: text,
        ...Object.fromEntries(
            series.flatMap((value, index) => [
                [`git${index}`, value],
                [`gitInv${index}`, value],
                [`gitBranchLabel${index}`, label]
            ])
        ),
        fontFamily: sansFontFamily()
    };
}

export function initMermaidThemeObserver() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (themeObserverInitialized) return;
    themeObserverInitialized = true;

    const observer = new MutationObserver(() => {
        const isDark = document.documentElement.classList.contains('dark');
        enhanceMermaidBlocks(document.body, isDark).catch(error =>
            console.error('Could not re-render Mermaid diagrams:', error)
        );
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

export async function enhanceMermaidBlocks(
    container: HTMLElement = document.body,
    forceTheme?: boolean | 'dark' | 'light'
) {
    initMermaidThemeObserver();

    const isDark =
        typeof forceTheme === 'boolean' ? forceTheme
        : typeof forceTheme === 'string' ? forceTheme === 'dark'
        : typeof document !== 'undefined' ? document.documentElement.classList.contains('dark')
        : true;

    const themeName = isDark ? 'dark' : 'light';
    const mermaidBlocks = container.querySelectorAll<HTMLElement>('.mdrs-mermaid');
    if (!mermaidBlocks.length) return;

    const mermaid = await getMermaid(isDark);

    for (let i = 0; i < mermaidBlocks.length; i++) {
        const block = mermaidBlocks[i];
        const prevTheme = block.getAttribute('data-mdrs-theme');
        if (prevTheme === themeName && block.querySelector('.mdrs-mermaid-display svg')) {
            continue;
        }

        const rawCodeEl = block.querySelector<HTMLElement>('.mdrs-mermaid-source');
        const displayEl = block.querySelector<HTMLElement>('.mdrs-mermaid-display');
        if (!rawCodeEl || !displayEl) continue;

        const rawCode = decodeURIComponent(rawCodeEl.getAttribute('data-mdrs-source') || '').trim();
        if (!rawCode) continue;

        const uniqueId = `mdrs-mermaid-svg-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;

        try {
            const { svg } = await mermaid.render(uniqueId, rawCode);
            displayEl.innerHTML = svg;
            block.setAttribute('data-mdrs-theme', themeName);
            block.setAttribute('data-mdrs-enhanced', 'true');

            const svgEl = displayEl.querySelector<SVGElement>('svg');
            svgEl?.classList.add('mdrs-mermaid-svg');

            attachDiagramToolbar(block, svg, rawCode);
        } catch (err) {
            const error = document.createElement('div');
            error.className = 'mdrs-mermaid-error';
            error.textContent = `Failed to render Mermaid diagram: ${(err as Error).message}`;
            displayEl.replaceChildren(error);
        }
    }
}

function attachDiagramToolbar(block: HTMLElement, svgString: string, rawCode: string) {
    const existingToolbar = block.querySelector('.mdrs-mermaid-toolbar');
    if (existingToolbar) {
        existingToolbar.remove();
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'mdrs-mermaid-toolbar';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'mdrs-menu-button';
    menuButton.setAttribute('aria-label', 'Diagram options');
    menuButton.innerHTML = `<svg class="mdrs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;

    const dropdown = document.createElement('div');
    dropdown.className = 'mdrs-menu';

    const copySvgItem = document.createElement('button');
    copySvgItem.type = 'button';
    copySvgItem.className = 'mdrs-menu-item';
    copySvgItem.innerHTML = `<svg class="mdrs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy SVG</span>`;

    copySvgItem.onclick = async e => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(svgString);
            copySvgItem.innerHTML = `<svg class="mdrs-icon mdrs-is-done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><span class="mdrs-is-done">Copied SVG!</span>`;
            setTimeout(() => {
                dropdown.classList.remove('mdrs-is-open');
                copySvgItem.innerHTML = `<svg class="mdrs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy SVG</span>`;
            }, 1200);
        } catch {}
    };

    const copyCodeItem = document.createElement('button');
    copyCodeItem.type = 'button';
    copyCodeItem.className = 'mdrs-menu-item';
    copyCodeItem.innerHTML = `<svg class="mdrs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><span>Copy code</span>`;

    copyCodeItem.onclick = async e => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(rawCode);
            copyCodeItem.innerHTML = `<svg class="mdrs-icon mdrs-is-done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><span class="mdrs-is-done">Copied Code!</span>`;
            setTimeout(() => {
                dropdown.classList.remove('mdrs-is-open');
                copyCodeItem.innerHTML = `<svg class="mdrs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><span>Copy code</span>`;
            }, 1200);
        } catch {}
    };

    menuButton.onclick = e => {
        e.stopPropagation();
        dropdown.classList.toggle('mdrs-is-open');
    };

    const closeMenu = (e: MouseEvent) => {
        if (!toolbar.isConnected) {
            window.removeEventListener('click', closeMenu);
            return;
        }
        if (!toolbar.contains(e.target as Node)) {
            dropdown.classList.remove('mdrs-is-open');
        }
    };
    window.addEventListener('click', closeMenu);

    dropdown.appendChild(copySvgItem);
    dropdown.appendChild(copyCodeItem);
    toolbar.appendChild(menuButton);
    toolbar.appendChild(dropdown);
    block.appendChild(toolbar);
}
