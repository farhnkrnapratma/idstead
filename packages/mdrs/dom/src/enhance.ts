// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

import { enhanceCodeBlocks } from './codeBlocks';
import { enhanceMermaidBlocks } from './mermaid';
import { enhanceMarkdownCharts } from './charts';
import { enhanceMarkdownTabs } from './tabs';
import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
import { focusScope } from '@idstead/ui/utils/focusScope.ts';
import { nextCodeScope } from './codeBlocks';

function enhanceMarkdownDetails(container: ParentNode) {
    container.querySelectorAll<HTMLDetailsElement>('details.mdrs-details').forEach(details => {
        if (details.dataset.mdrsEnhanced === 'true') return;
        const summary = details.querySelector<HTMLElement>('summary');
        if (!summary) return;
        details.dataset.mdrsEnhanced = 'true';
        const scope = nextCodeScope('details');
        focusScope(details, scope);
        const title =
            summary.querySelector('.mdrs-details-title')?.textContent?.trim() || 'section';
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
