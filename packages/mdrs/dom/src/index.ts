// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: MIT OR Apache-2.0

export { default as CodeTabs } from './CodeTabs.svelte';
export { default as MarkdownChart } from './MarkdownChart.svelte';
export { enhanceMarkdownContent } from './enhance';
export {
    enhanceHeadingAnchors,
    resolveMdrsHash,
    activateHeadingAnchor,
    mdrsFragment
} from './headingAnchors';
export type { HeadingAnchorOptions, HeadingLink } from './headingAnchors';
export {
    refreshCodeBlockPrefs,
    applyCodeThemeVariables,
    ensureHljsThemeStylesheet,
    splitHighlightedHtmlLines,
    type CodeColorScheme
} from './codeBlocks';
export { codeBlockPrefsStore } from './codeBlockPrefsStore.svelte';
