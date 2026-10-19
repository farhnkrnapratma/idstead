import {
    createCodeActionControls,
    getRawLanguage,
    isShellLanguage,
    isShellScript
} from './codeBlocks';
import { getDownloadFilename } from './codeBlockExtensions';
import { registerPrefsListener, nextCodeScope } from './codeBlocks';
import { shortcut } from '@fkp/ui/utils/shortcut.svelte.ts';
import { focusScope } from '@fkp/ui/utils/focusScope.ts';

const tabPreferences = new Map<string, string>();
const tabListeners = new Set<(key: string, value: string) => void>();

export function setTabPreference(key: string, value: string) {
    tabPreferences.set(key, value);
    tabListeners.forEach(listener => listener(key, value));
}

export function onTabPreference(listener: (key: string, value: string) => void) {
    tabListeners.add(listener);
    return () => {
        tabListeners.delete(listener);
    };
}

export function getTabPreference(key: string): string | undefined {
    return tabPreferences.get(key);
}

export function enhanceMarkdownTabs(
    container: HTMLElement = document.body,
    triggerToast?: (message: string) => void
) {
    const root =
        container.classList.contains('mdrs') ?
            container
        :   (container.querySelector('.mdrs') as HTMLElement) || container;
    if (!root) return;

    const tabContainers = root.querySelectorAll<HTMLElement>('.mdrs-snippets, .mdrs-tabs');

    tabContainers.forEach(tabsEl => {
        if (tabsEl.dataset.mdrsEnhanced === 'true') return;
        tabsEl.dataset.mdrsEnhanced = 'true';

        const isContentGroup = tabsEl.classList.contains('mdrs-tabs');
        const syncKey = tabsEl.getAttribute('data-mdrs-tab-key');
        const ownedBy = (selector: string) =>
            Array.from(tabsEl.querySelectorAll<HTMLElement>(selector)).filter(
                el => el.closest('.mdrs-snippets, .mdrs-tabs') === tabsEl
            );
        const tabButtons = ownedBy('.mdrs-tab');
        const tabPanels = ownedBy('.mdrs-tab-panel');

        let codeControls: ReturnType<typeof createCodeActionControls> | null = null;
        const tabsScope = nextCodeScope('tabs');
        focusScope(tabsEl, tabsScope);

        if (!isContentGroup) {
            let actionsWrapper = tabsEl.querySelector<HTMLElement>('.mdrs-snippets-actions');
            const headerEl = tabsEl.querySelector<HTMLElement>('.mdrs-snippets-header');

            if (!actionsWrapper && headerEl) {
                actionsWrapper = document.createElement('div');
                actionsWrapper.className = 'mdrs-snippets-actions';
                headerEl.appendChild(actionsWrapper);
            }

            if (actionsWrapper && !actionsWrapper.hasChildNodes()) {
                codeControls = createCodeActionControls({
                    getCodeText: () => {
                        const activePanel = tabsEl.querySelector<HTMLElement>(
                            '.mdrs-tab-panel:not([hidden])'
                        );
                        const codeEl = activePanel?.querySelector('code');
                        return codeEl?.innerText || codeEl?.textContent || '';
                    },
                    getDownloadFilename: () => {
                        const activePanel = tabsEl.querySelector<HTMLElement>(
                            '.mdrs-tab-panel:not([hidden])'
                        );
                        const codeEl = activePanel?.querySelector('code');
                        return getDownloadFilename(
                            codeEl?.className || '',
                            codeEl?.closest('pre')?.dataset.mdrsFilename
                        );
                    },
                    shouldHideLineNumbers: () => {
                        const activePanel = tabsEl.querySelector<HTMLElement>(
                            '.mdrs-tab-panel:not([hidden])'
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
                btn.classList.toggle('mdrs-is-active', isSelected);
            });

            tabPanels.forEach((panel, idx) => {
                const isSelected = idx === targetIndex;
                panel.hidden = !isSelected;
            });

            if (codeControls) {
                codeControls.applyPrefs();
            }

            if (isContentGroup && typeof window !== 'undefined') {
                window.dispatchEvent(new Event('resize'));
            }

            if (shouldSync && syncKey) {
                const label = tabButtons[targetIndex]?.getAttribute('data-mdrs-tab-label') || '';
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
                    label: `Tab: ${btn.getAttribute('data-mdrs-tab-label') || idx + 1}`,
                    scope: tabsScope,
                    placement: 'inline'
                });
            }
        });

        if (syncKey) {
            const currentPref = getTabPreference(syncKey);
            if (currentPref) {
                const matchedIdx = Array.from(tabButtons).findIndex(
                    b => b.getAttribute('data-mdrs-tab-label') === currentPref
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
                        b => b.getAttribute('data-mdrs-tab-label') === value
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
