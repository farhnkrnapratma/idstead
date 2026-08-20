import {codeBlockPrefsStore} from '../stores/codeBlockPrefsStore.svelte';
import type {CodeColorScheme} from './hljsTheme';
import {getDownloadFilename} from './codeBlockExtensions';
import {cn} from './cn';

const LANGUAGE_NAMES: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  html: 'HTML',
  css: 'CSS',
  rust: 'Rust',
  rs: 'Rust',
  python: 'Python',
  py: 'Python',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  md: 'Markdown',
  markdown: 'Markdown',
  go: 'Go',
  golang: 'Go',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  cs: 'C#',
  sql: 'SQL',
  dockerfile: 'Docker',
  docker: 'Docker'
};

export function getPrettyLanguage(className: string): string {
  if (!className) return 'Code';
  const match = className.match(/language-(\S+)/);
  if (!match) return 'Code';
  const lang = match[1].toLowerCase();
  return LANGUAGE_NAMES[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

export function splitHighlightedHtmlLines(html: string): string[] {
  const lines = html.split('\n');
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

const ICON_BUTTON_CLASS =
  'flex h-5 w-5 items-center justify-center rounded-sm border border-border-subtle/30 hover:bg-surface-hover/30 hover:text-text-primary transition-colors cursor-pointer text-text-secondary leading-none';

const ICONS = {
  copy: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  sun: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  moon: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>',
  sunMoon:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun-moon"><path d="M12 2v2"/><path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715"/><path d="M16 12a4 4 0 0 0-4-4"/><path d="m19 5-1.256 1.256"/><path d="M20 12h2"/></svg>',
  kebab:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis-vertical"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
  download:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>',
  check:
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>'
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

const LIGHT_CHROME_VARS: Record<string, string> = {
  '--color-surface-hover': 'rgba(16, 20, 17, 0.04)',
  '--color-surface-card': '#ffffff',
  '--color-code-chrome': '#e9ece9',
  '--color-border-subtle': '#e4ebe6',
  '--color-border-default': '#b6bfb8',
  '--color-text-secondary': '#232925',
  '--color-text-primary': '#101411',
  '--color-text-muted': '#909692',
  '--color-copilot': '#8534f3',
  '--color-code-thumb': 'var(--color-gh-gray-3)',
  '--color-code-thumb-hover': 'var(--color-gh-gray-4)',
  '--color-accent-subtle': 'rgba(15, 191, 62, 0.08)'
};

const DARK_CHROME_VARS: Record<string, string> = {
  '--color-surface-hover': 'rgba(242, 245, 243, 0.05)',
  '--color-surface-card': '#101411',
  '--color-code-chrome': '#111311',
  '--color-border-subtle': 'rgba(228, 235, 230, 0.12)',
  '--color-border-default': 'rgba(182, 191, 184, 0.25)',
  '--color-text-secondary': '#b6bfb8',
  '--color-text-primary': '#f2f5f3',
  '--color-text-muted': '#909692',
  '--color-copilot': '#b870ff',
  '--color-code-thumb': 'var(--color-gh-gray-6)',
  '--color-code-thumb-hover': 'var(--color-gh-gray-5)',
  '--color-accent-subtle': 'rgba(15, 191, 62, 0.14)'
};

function applyChromeVars(el: HTMLElement, isDark: boolean) {
  const vars = isDark ? DARK_CHROME_VARS : LIGHT_CHROME_VARS;
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
}

function resolveEffectiveIsDark(scheme: CodeColorScheme): boolean {
  if (scheme === 'light') return false;
  if (scheme === 'dark') return true;
  return document.documentElement.classList.contains('dark');
}

interface EnhancedBlock {
  pre: HTMLElement;
  applyPrefs: () => void;
}

const enhancedBlocks: EnhancedBlock[] = [];
let siteThemeObserverAttached = false;

export function refreshCodeBlockPrefs() {
  for (let i = enhancedBlocks.length - 1; i >= 0; i--) {
    const block = enhancedBlocks[i];
    if (!document.contains(block.pre)) {
      enhancedBlocks.splice(i, 1);
      continue;
    }
    block.applyPrefs();
  }
}

function ensureSiteThemeObserver() {
  if (siteThemeObserverAttached) return;
  siteThemeObserverAttached = true;

  const observer = new MutationObserver(() => {
    if (codeBlockPrefsStore.current.colorScheme === 'auto') {
      refreshCodeBlockPrefs();
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
}

function buildMenuCheckboxRow(
  label: string,
  getChecked: () => boolean,
  onToggle: () => void
) {
  const row = document.createElement('button');
  row.type = 'button';
  row.setAttribute('role', 'menuitemcheckbox');
  row.className =
    'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover';

  const box = document.createElement('span');
  const labelEl = document.createElement('span');
  labelEl.textContent = label;

  row.appendChild(box);
  row.appendChild(labelEl);

  function sync() {
    const checked = getChecked();
    row.setAttribute('aria-checked', String(checked));
    box.innerHTML = checked ? ICONS.check : '';
    box.className = cn(
      'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors',
      checked ?
        'border-copilot bg-copilot text-text-on-accent'
      : 'border-border-default text-transparent'
    );
  }

  row.addEventListener('click', () => {
    onToggle();
    refreshCodeBlockPrefs();
  });

  sync();
  return {row, sync};
}

export function enhanceCodeBlocks(triggerToast: (message: string) => void) {
  const container = document.querySelector('.prose-custom');
  if (!container) return;

  ensureSiteThemeObserver();

  container.querySelectorAll('pre').forEach(el => {
    const pre = el as HTMLElement;
    if (pre.dataset.enhanced === 'true') return;
    pre.dataset.enhanced = 'true';

    const codeElement = pre.querySelector('code');
    const prettyLang = getPrettyLanguage(codeElement?.className || '');

    const highlightedLines = new Set(
      (pre.dataset.highlightLines || '')
        .split(',')
        .map(part => parseInt(part, 10))
        .filter(line => Number.isInteger(line) && line > 0)
    );

    const headerBar = document.createElement('div');
    headerBar.className =
      'code-header-bar flex items-center justify-between bg-(--color-code-chrome) border border-border-subtle rounded-t-sm px-3 py-1 text-xs text-text-secondary font-semibold select-none mt-6';

    const leftSpan = document.createElement('span');
    leftSpan.className =
      'text-[12.5px] font-sans font-bold uppercase tracking-wider text-text-secondary leading-none';
    leftSpan.innerText = prettyLang;
    headerBar.appendChild(leftSpan);

    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-1';
    headerBar.appendChild(controls);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = ICON_BUTTON_CLASS;
    copyBtn.setAttribute('aria-label', 'Copy code');
    copyBtn.innerHTML = ICONS.copy;

    copyBtn.addEventListener('click', () => {
      if (!codeElement) return;
      const codeText = codeElement.innerText || codeElement.textContent || '';
      navigator.clipboard
        .writeText(codeText)
        .then(() => {
          triggerToast('Copied!');
        })
        .catch(err => {
          console.error('Failed to copy code: ', err);
        });
    });

    controls.appendChild(copyBtn);

    const themeToggleBtn = document.createElement('button');
    themeToggleBtn.type = 'button';
    themeToggleBtn.className = ICON_BUTTON_CLASS;
    const themeIconStage = document.createElement('span');
    themeIconStage.className = 'inline-flex items-center justify-center';
    themeToggleBtn.appendChild(themeIconStage);
    controls.appendChild(themeToggleBtn);

    themeToggleBtn.addEventListener('click', () => {
      themeIconStage.classList.remove('code-icon-in');
      themeIconStage.classList.add('code-icon-out');

      themeIconStage.addEventListener(
        'animationend',
        () => {
          themeIconStage.classList.remove('code-icon-out');
          codeBlockPrefsStore.cycleColorScheme();
          refreshCodeBlockPrefs();
          themeIconStage.classList.add('code-icon-in');
          themeIconStage.addEventListener(
            'animationend',
            () => themeIconStage.classList.remove('code-icon-in'),
            {once: true}
          );
        },
        {once: true}
      );
    });

    const kebabWrapper = document.createElement('div');
    kebabWrapper.className = 'relative';
    controls.appendChild(kebabWrapper);

    const kebabBtn = document.createElement('button');
    kebabBtn.type = 'button';
    kebabBtn.className = ICON_BUTTON_CLASS;
    kebabBtn.setAttribute('aria-label', 'Code block options');
    kebabBtn.setAttribute('aria-haspopup', 'true');
    kebabBtn.setAttribute('aria-expanded', 'false');
    kebabBtn.innerHTML = ICONS.kebab;
    kebabWrapper.appendChild(kebabBtn);

    const kebabPanel = document.createElement('div');
    kebabPanel.setAttribute('role', 'menu');
    kebabPanel.className =
      'hidden absolute right-0 top-[calc(100%+6px)] z-20 w-44 flex-col rounded-sm glass-overlay p-1 shadow-xl';
    kebabWrapper.appendChild(kebabPanel);

    function closeKebab() {
      kebabPanel.classList.add('hidden');
      kebabPanel.classList.remove('flex');
      kebabBtn.setAttribute('aria-expanded', 'false');
    }

    function openKebab() {
      kebabPanel.classList.remove('hidden');
      kebabPanel.classList.add('flex');
      kebabBtn.setAttribute('aria-expanded', 'true');
    }

    kebabBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (kebabPanel.classList.contains('hidden')) openKebab();
      else closeKebab();
    });

    document.addEventListener('click', e => {
      if (!kebabWrapper.contains(e.target as Node)) closeKebab();
    });

    const lineNumbersRow = buildMenuCheckboxRow(
      'Line numbers',
      () => codeBlockPrefsStore.current.lineNumbers,
      () => codeBlockPrefsStore.toggleLineNumbers()
    );
    const wrapRow = buildMenuCheckboxRow(
      'Wrap',
      () => codeBlockPrefsStore.current.wrap,
      () => codeBlockPrefsStore.toggleWrap()
    );

    const divider = document.createElement('div');
    divider.className = 'my-1 h-px bg-border-subtle';

    const downloadRow = document.createElement('button');
    downloadRow.type = 'button';
    downloadRow.setAttribute('role', 'menuitem');
    downloadRow.className =
      'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover';
    downloadRow.innerHTML = `<span class="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-text-secondary">${ICONS.download}</span><span>Download as file</span>`;

    downloadRow.addEventListener('click', () => {
      if (!codeElement) return;
      const filename = getDownloadFilename(codeElement.className);
      const text = codeElement.innerText || codeElement.textContent || '';
      const blob = new Blob([text], {type: 'text/plain'});
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

    kebabPanel.appendChild(lineNumbersRow.row);
    kebabPanel.appendChild(wrapRow.row);
    kebabPanel.appendChild(divider);
    kebabPanel.appendChild(downloadRow);

    const codeBody = document.createElement('div');
    codeBody.className =
      'code-body flex w-full flex-row items-stretch overflow-hidden rounded-sm border border-border-subtle bg-(--color-code-chrome)';
    codeBody.style.marginTop = '0px';
    codeBody.style.borderTopWidth = '0px';
    codeBody.style.borderTopLeftRadius = '0px';
    codeBody.style.borderTopRightRadius = '0px';

    pre.parentNode?.insertBefore(headerBar, pre);
    headerBar.insertAdjacentElement('afterend', codeBody);

    let gutter: HTMLDivElement | null = null;

    if (codeElement) {
      const lines = splitHighlightedHtmlLines(
        codeElement.innerHTML.replace(/\n$/, '')
      );
      codeElement.innerHTML = lines
        .map((line, i) => {
          const cls = cn(
            'code-line m-0 p-0 pr-3.5',
            highlightedLines.has(i + 1)
              && 'code-line-highlighted bg-(--color-accent-subtle)'
          );
          return `<div class="${cls}">${line}</div>`;
        })
        .join('');

      gutter = document.createElement('div');
      gutter.className =
        'code-line-numbers shrink-0 border-r border-border-subtle/30 bg-(--color-code-chrome) py-1.5 font-mono text-[0.8rem] leading-snug text-text-muted/50 select-none';
      lines.forEach((_, i) => {
        const num = document.createElement('div');
        num.className = cn(
          'pr-1.5 pl-2 text-right',
          highlightedLines.has(i + 1)
            && 'bg-(--color-accent-subtle) text-(--color-palette-primary)'
        );
        num.textContent = String(i + 1);
        gutter?.appendChild(num);
      });
      codeBody.appendChild(gutter);
    }

    pre.style.border = '0';
    pre.style.borderRadius = '0';
    pre.style.background = 'transparent';
    pre.style.margin = '0';
    pre.style.minWidth = '0';
    pre.style.flex = '1 1 0%';

    codeBody.appendChild(pre);

    const syncGutterRowHeights = () => {
      if (!gutter) return;
      const codeLineEls = [...pre.querySelectorAll<HTMLElement>('.code-line')];
      const gutterRowEls = [...gutter.children] as HTMLElement[];
      codeLineEls.forEach((lineEl, i) => {
        const rowEl = gutterRowEls[i];
        if (rowEl)
          rowEl.style.height = `${lineEl.getBoundingClientRect().height}px`;
      });
    };

    const wrapperBar = document.createElement('div');
    wrapperBar.className =
      'code-scrollbar-wrapper flex w-full flex-row items-stretch bg-(--color-code-chrome) border-x border-b border-border-subtle rounded-b-sm select-none mb-6 overflow-hidden transition-all';

    const gutterSpace = document.createElement('div');
    gutterSpace.className =
      'code-scrollbar-gutter-space shrink-0 bg-(--color-code-chrome) border-r border-border-subtle/30 py-1 min-h-[1.25rem] box-border';

    const codeSpace = document.createElement('div');
    codeSpace.className =
      'code-scrollbar-code-space flex flex-1 min-w-0 items-center px-2 py-1 bg-(--color-code-chrome)';

    const trackBar = document.createElement('div');
    trackBar.className =
      'code-scrollbar-track relative w-full h-2 rounded-full bg-border-subtle/30 cursor-pointer';

    const thumbBar = document.createElement('div');
    thumbBar.className =
      'code-scrollbar-thumb absolute top-0 left-0 h-full rounded-full bg-(--color-code-thumb) border border-border-subtle/40 shadow-xs transition-[left,width,background-color] duration-75 hover:bg-(--color-code-thumb-hover) cursor-grab active:cursor-grabbing';

    trackBar.appendChild(thumbBar);
    codeSpace.appendChild(trackBar);
    wrapperBar.appendChild(gutterSpace);
    wrapperBar.appendChild(codeSpace);

    function updateCustomScrollbar() {
      const scrollLeft = pre.scrollLeft;
      const scrollWidth = pre.scrollWidth;
      const clientWidth = pre.clientWidth;

      if (gutter && gutter.style.display !== 'none') {
        gutterSpace.style.width = `${gutter.getBoundingClientRect().width}px`;
      } else {
        gutterSpace.style.width = '0px';
      }

      if (scrollWidth <= clientWidth + 2) {
        wrapperBar.style.display = 'none';
        codeBody.style.borderBottomLeftRadius = '0.25rem';
        codeBody.style.borderBottomRightRadius = '0.25rem';
        codeBody.style.borderBottomWidth = '';
        codeBody.style.marginBottom = '1.5rem';
      } else {
        wrapperBar.style.display = 'flex';
        codeBody.style.borderBottomLeftRadius = '0px';
        codeBody.style.borderBottomRightRadius = '0px';
        codeBody.style.borderBottomWidth = '0px';
        codeBody.style.marginBottom = '0px';

        const thumbRatio = clientWidth / scrollWidth;
        const thumbWidthPercent = Math.max(thumbRatio * 100, 12);
        const maxThumbLeft = 100 - thumbWidthPercent;
        const maxScroll = scrollWidth - clientWidth;
        const thumbLeftPercent =
          maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumbLeft : 0;

        thumbBar.style.width = `${thumbWidthPercent}%`;
        thumbBar.style.left = `${thumbLeftPercent}%`;
      }
    }

    pre.addEventListener('scroll', updateCustomScrollbar, {passive: true});
    window.addEventListener('resize', updateCustomScrollbar);

    trackBar.addEventListener('click', e => {
      if (e.target === thumbBar) return;
      const rect = trackBar.getBoundingClientRect();
      const clickRatio = (e.clientX - rect.left) / rect.width;
      const maxScroll = pre.scrollWidth - pre.clientWidth;
      pre.scrollLeft = clickRatio * maxScroll;
    });

    let isDragging = false;
    let dragStartX = 0;
    let dragStartScrollLeft = 0;
    let dragTrackSlack = 0;

    thumbBar.addEventListener('mousedown', e => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartScrollLeft = pre.scrollLeft;
      dragTrackSlack = Math.max(
        trackBar.getBoundingClientRect().width
          - thumbBar.getBoundingClientRect().width,
        1
      );
      thumbBar.style.backgroundColor = 'var(--color-code-thumb-hover)';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const maxScroll = pre.scrollWidth - pre.clientWidth;
      const deltaX = e.clientX - dragStartX;
      const scrollableRatio = maxScroll / dragTrackSlack;
      pre.scrollLeft = dragStartScrollLeft + deltaX * scrollableRatio;
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      thumbBar.style.backgroundColor = '';
      document.body.style.userSelect = '';
    });

    codeBody.parentNode?.insertBefore(wrapperBar, codeBody.nextSibling);

    function applyPrefs() {
      const prefs = codeBlockPrefsStore.current;
      const effectiveIsDark = resolveEffectiveIsDark(prefs.colorScheme);

      applyChromeVars(headerBar, effectiveIsDark);
      applyChromeVars(codeBody, effectiveIsDark);
      applyChromeVars(wrapperBar, effectiveIsDark);

      themeIconStage.innerHTML = THEME_ICONS[prefs.colorScheme];
      themeToggleBtn.setAttribute(
        'aria-label',
        `Code color scheme: ${THEME_LABELS[prefs.colorScheme]}`
      );
      themeToggleBtn.title = `Code color scheme: ${THEME_LABELS[prefs.colorScheme]} (click to change)`;

      lineNumbersRow.sync();
      wrapRow.sync();

      if (gutter) gutter.style.display = prefs.lineNumbers ? '' : 'none';
      gutterSpace.style.display = prefs.lineNumbers ? '' : 'none';

      if (codeElement) {
        if (prefs.wrap) {
          codeElement.style.setProperty('white-space', 'pre-wrap', 'important');
          codeElement.style.setProperty('width', '100%', 'important');
          codeElement.style.setProperty(
            'overflow-wrap',
            'anywhere',
            'important'
          );
          pre.classList.add('code-wrap');
          pre.dataset.wrap = 'true';
        } else {
          codeElement.style.removeProperty('white-space');
          codeElement.style.removeProperty('width');
          codeElement.style.removeProperty('overflow-wrap');
          pre.classList.remove('code-wrap');
          pre.removeAttribute('data-wrap');
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

    enhancedBlocks.push({pre, applyPrefs});
  });
}
