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
    const mermaidBlocks = container.querySelectorAll<HTMLElement>('.mermaid-block');
    if (!mermaidBlocks.length) return;

    const mermaid = await getMermaid(isDark);

    for (let i = 0; i < mermaidBlocks.length; i++) {
        const block = mermaidBlocks[i];
        const prevTheme = block.getAttribute('data-mermaid-theme');
        if (prevTheme === themeName && block.querySelector('.mermaid-display svg')) {
            continue;
        }

        const rawCodeEl = block.querySelector<HTMLElement>('.mermaid-raw-code');
        const displayEl = block.querySelector<HTMLElement>('.mermaid-display');
        if (!rawCodeEl || !displayEl) continue;

        const rawCode = decodeURIComponent(rawCodeEl.getAttribute('data-content') || '').trim();
        if (!rawCode) continue;

        const uniqueId = `mermaid-svg-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;

        try {
            const { svg } = await mermaid.render(uniqueId, rawCode);
            displayEl.innerHTML = svg;
            block.setAttribute('data-mermaid-theme', themeName);
            block.setAttribute('data-mermaid-initialized', 'true');

            const svgEl = displayEl.querySelector<SVGElement>('svg');
            if (svgEl) {
                svgEl.classList.add('max-w-full', 'h-auto', 'mx-auto');
                svgEl.style.maxHeight = '500px';
            }

            attachDiagramToolbar(block, svg, rawCode);
        } catch (err) {
            displayEl.innerHTML = `<div class="p-4 text-xs font-mono text-danger">Failed to render Mermaid diagram: ${(err as Error).message}</div>`;
        }
    }
}

function attachDiagramToolbar(block: HTMLElement, svgString: string, rawCode: string) {
    const existingToolbar = block.querySelector('.mermaid-toolbar');
    if (existingToolbar) {
        existingToolbar.remove();
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'mermaid-toolbar absolute top-2 right-2 z-10';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className =
        'flex size-7 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring';
    menuButton.setAttribute('aria-label', 'Diagram options');
    menuButton.innerHTML = `<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;

    const dropdown = document.createElement('div');
    dropdown.className =
        'absolute top-full right-0 z-20 mt-1.5 hidden min-w-[9rem] flex-col rounded-md border border-border-subtle bg-surface-card p-1 shadow-lg backdrop-blur-md';

    const copySvgItem = document.createElement('button');
    copySvgItem.type = 'button';
    copySvgItem.className =
        'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary';
    copySvgItem.innerHTML = `<svg class="size-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy SVG</span>`;

    copySvgItem.onclick = async e => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(svgString);
            copySvgItem.innerHTML = `<svg class="size-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><span class="font-semibold text-accent">Copied SVG!</span>`;
            setTimeout(() => {
                dropdown.classList.add('hidden');
                copySvgItem.innerHTML = `<svg class="size-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>Copy SVG</span>`;
            }, 1200);
        } catch {}
    };

    const copyCodeItem = document.createElement('button');
    copyCodeItem.type = 'button';
    copyCodeItem.className =
        'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary';
    copyCodeItem.innerHTML = `<svg class="size-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><span>Copy code</span>`;

    copyCodeItem.onclick = async e => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(rawCode);
            copyCodeItem.innerHTML = `<svg class="size-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><span class="font-semibold text-accent">Copied Code!</span>`;
            setTimeout(() => {
                dropdown.classList.add('hidden');
                copyCodeItem.innerHTML = `<svg class="size-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><span>Copy code</span>`;
            }, 1200);
        } catch {}
    };

    menuButton.onclick = e => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    };

    const closeMenu = (e: MouseEvent) => {
        if (!toolbar.contains(e.target as Node)) {
            dropdown.classList.add('hidden');
        }
    };
    window.addEventListener('click', closeMenu);

    dropdown.appendChild(copySvgItem);
    dropdown.appendChild(copyCodeItem);
    toolbar.appendChild(menuButton);
    toolbar.appendChild(dropdown);
    block.appendChild(toolbar);
}
