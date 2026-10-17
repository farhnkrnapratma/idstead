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
        themeVariables:
            isDark ?
                {
                    darkMode: true,
                    background: 'transparent',
                    mainBkg: '#182234',
                    nodeBkg: '#182234',
                    nodeBorder: '#334155',
                    nodeTextColor: '#f1f5f9',
                    titleColor: '#f1f5f9',
                    edgeLabelBackground: '#0f172a',
                    textColor: '#f1f5f9',
                    lineColor: '#10b981',
                    primaryColor: '#10b981',
                    primaryTextColor: '#ffffff',
                    primaryBorderColor: '#059669',
                    secondaryColor: '#1e293b',
                    secondaryTextColor: '#f1f5f9',
                    secondaryBorderColor: '#334155',
                    tertiaryColor: '#0f172a',
                    tertiaryTextColor: '#f1f5f9',
                    tertiaryBorderColor: '#1e293b',
                    actorBkg: '#182234',
                    actorBorder: '#334155',
                    actorTextColor: '#f1f5f9',
                    actorLineColor: '#64748b',
                    signalColor: '#10b981',
                    signalTextColor: '#f1f5f9',
                    labelBoxBkgColor: '#182234',
                    labelBoxBorderColor: '#334155',
                    labelTextColor: '#f1f5f9',
                    git0: '#10b981',
                    git1: '#3b82f6',
                    git2: '#f59e0b',
                    git3: '#ec4899',
                    gitBranchLabel0: '#ffffff',
                    gitBranchLabel1: '#ffffff',
                    gitBranchLabel2: '#ffffff',
                    gitBranchLabel3: '#ffffff',
                    gitInv0: '#10b981',
                    gitInv1: '#3b82f6',
                    gitInv2: '#f59e0b',
                    gitInv3: '#ec4899',
                    fontFamily:
                        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }
            :   {
                    darkMode: false,
                    background: 'transparent',
                    mainBkg: '#f8fafc',
                    nodeBkg: '#f8fafc',
                    nodeBorder: '#cbd5e1',
                    nodeTextColor: '#0f172a',
                    titleColor: '#0f172a',
                    edgeLabelBackground: '#ffffff',
                    textColor: '#0f172a',
                    lineColor: '#059669',
                    primaryColor: '#059669',
                    primaryTextColor: '#ffffff',
                    primaryBorderColor: '#047857',
                    secondaryColor: '#f1f5f9',
                    secondaryTextColor: '#0f172a',
                    secondaryBorderColor: '#cbd5e1',
                    tertiaryColor: '#ffffff',
                    tertiaryTextColor: '#0f172a',
                    tertiaryBorderColor: '#e2e8f0',
                    actorBkg: '#f8fafc',
                    actorBorder: '#cbd5e1',
                    actorTextColor: '#0f172a',
                    actorLineColor: '#94a3b8',
                    signalColor: '#059669',
                    signalTextColor: '#0f172a',
                    labelBoxBkgColor: '#ffffff',
                    labelBoxBorderColor: '#cbd5e1',
                    labelTextColor: '#0f172a',
                    git0: '#059669',
                    git1: '#2563eb',
                    git2: '#d97706',
                    git3: '#db2777',
                    gitBranchLabel0: '#ffffff',
                    gitBranchLabel1: '#ffffff',
                    gitBranchLabel2: '#ffffff',
                    gitBranchLabel3: '#ffffff',
                    gitInv0: '#059669',
                    gitInv1: '#2563eb',
                    gitInv2: '#d97706',
                    gitInv3: '#db2777',
                    fontFamily:
                        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }
    });

    return mermaidInstance;
}

export function initMermaidThemeObserver() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (themeObserverInitialized) return;
    themeObserverInitialized = true;

    const observer = new MutationObserver(() => {
        const isDark = document.documentElement.classList.contains('dark');
        enhanceMermaidBlocks(document.body, isDark);
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
