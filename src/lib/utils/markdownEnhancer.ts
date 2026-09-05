import {enhanceCodeBlocks} from './codeBlocks';
import {enhanceMermaidBlocks} from './mermaid';
import {enhanceMarkdownCharts} from './markdownCharts';
import {enhanceMarkdownTabs} from './markdownTabs';

export interface MarkdownEnhanceOptions {
  container?: HTMLElement | Element | null;
  isDark?: boolean;
  onCodeCopy?: (message: string) => void;
}

export async function enhanceMarkdownContent(
  options: MarkdownEnhanceOptions = {}
) {
  const container = (options.container as HTMLElement) || document.body;
  const isDark =
    options.isDark
    ?? (typeof document !== 'undefined' ?
      document.documentElement.classList.contains('dark')
    : true);
  const onCopy = options.onCodeCopy || (() => {});

  enhanceCodeBlocks(onCopy, container);
  enhanceMarkdownTabs(container, onCopy);
  enhanceMarkdownCharts(container);
  await enhanceMermaidBlocks(container, isDark);
}
