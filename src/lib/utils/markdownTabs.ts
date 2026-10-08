import {
  createCodeActionControls,
  getRawLanguage,
  isShellLanguage,
  isShellScript
} from './codeBlocks';
import {getDownloadFilename} from './codeBlockExtensions';
import {registerPrefsListener, nextCodeScope} from './codeBlocks';
import {shortcut} from './shortcut.svelte';
import {focusScope} from './focusScope';

const tabPreferences = new Map<string, string>();
const tabListeners = new Set<(key: string, value: string) => void>();

export function setTabPreference(key: string, value: string) {
  tabPreferences.set(key, value);
  tabListeners.forEach(listener => listener(key, value));
}

export function getTabPreference(key: string): string | undefined {
  return tabPreferences.get(key);
}

export function enhanceMarkdownTabs(
  container: HTMLElement = document.body,
  triggerToast?: (message: string) => void
) {
  const root =
    container.classList.contains('prose-custom') ?
      container
    : (container.querySelector('.prose-custom') as HTMLElement) || container;
  if (!root) return;

  const tabContainers = root.querySelectorAll<HTMLElement>(
    '.markdown-tabs-container, .markdown-tab-group'
  );

  tabContainers.forEach(tabsEl => {
    if (tabsEl.dataset.tabsEnhanced === 'true') return;
    tabsEl.dataset.tabsEnhanced = 'true';

    const isContentGroup = tabsEl.classList.contains('markdown-tab-group');
    const syncKey = tabsEl.getAttribute('data-tab-group-key');
    const ownedBy = (selector: string) =>
      Array.from(tabsEl.querySelectorAll<HTMLElement>(selector)).filter(
        el =>
          el.closest('.markdown-tabs-container, .markdown-tab-group') === tabsEl
      );
    const tabButtons = ownedBy('.markdown-tab-button');
    const tabPanels = ownedBy('.markdown-tab-panel');

    let codeControls: ReturnType<typeof createCodeActionControls> | null = null;
    const tabsScope = nextCodeScope('tabs');
    focusScope(tabsEl, tabsScope);

    if (!isContentGroup) {
      let actionsWrapper = tabsEl.querySelector<HTMLElement>(
        '.markdown-tabs-actions'
      );
      const headerEl = tabsEl.querySelector<HTMLElement>(
        '.markdown-tabs-header'
      );

      if (!actionsWrapper && headerEl) {
        actionsWrapper = document.createElement('div');
        actionsWrapper.className =
          'markdown-tabs-actions flex items-center gap-1';
        headerEl.appendChild(actionsWrapper);
      }

      if (actionsWrapper && !actionsWrapper.hasChildNodes()) {
        codeControls = createCodeActionControls({
          getCodeText: () => {
            const activePanel = tabsEl.querySelector<HTMLElement>(
              '.markdown-tab-panel:not([hidden])'
            );
            const codeEl = activePanel?.querySelector('code');
            return codeEl?.innerText || codeEl?.textContent || '';
          },
          getDownloadFilename: () => {
            const activePanel = tabsEl.querySelector<HTMLElement>(
              '.markdown-tab-panel:not([hidden])'
            );
            const codeEl = activePanel?.querySelector('code');
            return getDownloadFilename(
              codeEl?.className || '',
              codeEl?.closest('pre')?.dataset.filename
            );
          },
          shouldHideLineNumbers: () => {
            const activePanel = tabsEl.querySelector<HTMLElement>(
              '.markdown-tab-panel:not([hidden])'
            );
            const codeEl = activePanel?.querySelector('code');
            const rawLang = getRawLanguage(codeEl?.className || '');
            const codeText = codeEl?.innerText || codeEl?.textContent || '';
            return isShellLanguage(rawLang) && !isShellScript(codeText);
          },
          triggerToast: triggerToast || (() => {}),
          shortcutScope: tabsScope
        });
        actionsWrapper.appendChild(codeControls.controls);
        codeControls.applyPrefs();
        registerPrefsListener(codeControls.applyPrefs, codeControls.controls);
      }
    }

    function selectTab(targetIndex: number, shouldSync = true) {
      tabButtons.forEach((btn, idx) => {
        const isSelected = idx === targetIndex;
        btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        btn.classList.toggle('active-tab', isSelected);
        btn.classList.toggle('text-accent', isSelected);
        btn.classList.toggle('border-b-accent', isSelected);
        btn.classList.toggle('font-bold', isSelected);

        btn.classList.toggle('text-text-muted', !isSelected);
        btn.classList.toggle('border-b-transparent', !isSelected);
      });

      tabPanels.forEach((panel, idx) => {
        const isSelected = idx === targetIndex;
        panel.hidden = !isSelected;
        panel.classList.toggle('hidden', !isSelected);
        panel.classList.toggle('block', isSelected);
      });

      if (codeControls) {
        codeControls.applyPrefs();
      }

      if (isContentGroup && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('resize'));
      }

      if (shouldSync && syncKey) {
        const label =
          tabButtons[targetIndex]?.getAttribute('data-tab-label') || '';
        if (label) {
          setTabPreference(syncKey, label);
        }
      }
    }

    tabButtons.forEach((btn, idx) => {
      btn.addEventListener('click', () => selectTab(idx, true));
      if (idx < 9) {
        shortcut(btn, {
          combo: String(idx + 1),
          label: `Tab: ${btn.getAttribute('data-tab-label') || idx + 1}`,
          scope: tabsScope,
          placement: 'inline'
        });
      }
    });

    if (syncKey) {
      const currentPref = getTabPreference(syncKey);
      if (currentPref) {
        const matchedIdx = Array.from(tabButtons).findIndex(
          b => b.getAttribute('data-tab-label') === currentPref
        );
        if (matchedIdx !== -1) {
          selectTab(matchedIdx, false);
        }
      }

      const syncHandler = (key: string, value: string) => {
        if (!tabsEl.isConnected) {
          tabListeners.delete(syncHandler);
          return;
        }
        if (key === syncKey) {
          const matchedIdx = Array.from(tabButtons).findIndex(
            b => b.getAttribute('data-tab-label') === value
          );
          if (matchedIdx !== -1) {
            selectTab(matchedIdx, false);
          }
        }
      };

      tabListeners.add(syncHandler);
    }
  });
}
