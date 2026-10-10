import { enhanceCodeBlocks } from './codeBlocks';
import { enhanceMermaidBlocks } from './mermaid';
import { enhanceMarkdownCharts } from './markdownCharts';
import { enhanceMarkdownTabs } from './markdownTabs';
import { shortcut } from './shortcut.svelte';
import { focusScope } from './focusScope';
import { nextCodeScope } from './codeBlocks';

function enhanceMarkdownDetails(container: ParentNode) {
    container.querySelectorAll<HTMLDetailsElement>('details.markdown-details').forEach(details => {
        if (details.dataset.shortcutEnhanced === 'true') return;
        const summary = details.querySelector<HTMLElement>('summary');
        if (!summary) return;
        details.dataset.shortcutEnhanced = 'true';
        const scope = nextCodeScope('details');
        focusScope(details, scope);
        summary.classList.add('relative');
        const title =
            summary.querySelector('.markdown-details-title')?.textContent?.trim() || 'section';
        shortcut(summary, {
            combo: 'E',
            label: `Expand or collapse ${title}`,
            scope,
            placement: 'trailing'
        });
    });
}

export interface MarkdownEnhanceOptions {
    container?: HTMLElement | Element | null;
    isDark?: boolean;
    onCodeCopy?: (message: string) => void;
}

export async function enhanceMarkdownContent(options: MarkdownEnhanceOptions = {}) {
    const container = (options.container as HTMLElement) || document.body;
    const isDark =
        options.isDark
        ?? (typeof document !== 'undefined' ?
            document.documentElement.classList.contains('dark')
        :   true);
    const onCopy = options.onCodeCopy || (() => {});

    enhanceCodeBlocks(onCopy, container);
    enhanceMarkdownTabs(container, onCopy);
    enhanceMarkdownDetails(container);
    enhanceMarkdownCharts(container);
    await enhanceMermaidBlocks(container, isDark);
}
