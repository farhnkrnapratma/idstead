<script lang="ts">
  import {onMount, tick} from 'svelte';
  import {
    Heading1,
    Heading2,
    Heading3,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Code,
    Image as ImageIcon,
    Link2 as LinkIcon,
    ListOrdered,
    List,
    ListTodo,
    Quote,
    SquareCode,
    Table as TableIcon,
    Minus,
    Indent,
    ChevronDown,
    Check
  } from '@lucide/svelte';
  import {renderMarkdown} from '$lib/markdown';
  import {
    enhanceCodeBlocks,
    splitHighlightedHtmlLines
  } from '$lib/utils/codeBlocks';
  import hljs from 'highlight.js';
  import {cn} from '$lib/utils/cn';

  interface Props {
    value?: string;
    autosaveKey?: string;
    placeholder?: string;
    minHeight?: string;
    stickyTopClass?: string;
    class?: string;
    onImageUpload?: (file: File) => Promise<string | null>;
  }

  let {
    value = $bindable(''),
    autosaveKey = '',
    placeholder = 'Write your markdown content here...',
    minHeight = '400px',
    stickyTopClass = 'top-0',
    class: className = '',
    onImageUpload
  }: Props = $props();

  let activeTab = $state<'editor' | 'preview'>('editor');
  let previewHtml = $state('');
  let lineWrapMode = $state<'soft' | 'none'>('soft');
  let indentMode = $state<'spaces' | 'tabs'>('spaces');
  let indentSize = $state(4);

  let indentModeDropdownOpen = $state(false);
  let indentSizeDropdownOpen = $state(false);
  let wrapModeDropdownOpen = $state(false);

  let currentLine = $state(1);
  let currentColumn = $state(1);
  let lineHeights = $state<number[]>([]);

  let markdownTextareaElement = $state<HTMLTextAreaElement | null>(null);
  let preElement = $state<HTMLPreElement | null>(null);
  let headerSentinelElement = $state<HTMLDivElement | null>(null);
  let toolbarSentinelElement = $state<HTMLDivElement | null>(null);
  let isHeaderStuck = $state(false);
  let isToolbarStuck = $state(false);
  let imageFileInput = $state<HTMLInputElement | null>(null);

  let autoSaveStatus = $state<'saving' | 'saved' | 'idle'>('idle');
  let autoSaveTimer: ReturnType<typeof setTimeout>;

  const lineCount = $derived((value || '').split('\n').length);
  const lineEnding = $derived((value || '').includes('\r\n') ? 'CRLF' : 'LF');

  const highlightedMarkdown = $derived.by(() => {
    try {
      const code = value || '';
      const res = hljs.highlight(code, {language: 'markdown'}).value;
      return res + (code.endsWith('\n') ? '\n ' : '');
    } catch {
      return value || '';
    }
  });

  $effect(() => {
    if (typeof window === 'undefined' || !headerSentinelElement) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isHeaderStuck = !entry.isIntersecting;
      },
      {threshold: 0}
    );
    observer.observe(headerSentinelElement);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (typeof window === 'undefined' || !toolbarSentinelElement) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isToolbarStuck = !entry.isIntersecting;
      },
      {threshold: 0}
    );
    observer.observe(toolbarSentinelElement);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (autosaveKey && value) {
      autoSaveStatus = 'saving';
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        const data = {content: value, timestamp: Date.now()};
        localStorage.setItem(autosaveKey, JSON.stringify(data));
        autoSaveStatus = 'saved';
        setTimeout(() => {
          if (autoSaveStatus === 'saved') autoSaveStatus = 'idle';
        }, 1500);
      }, 500);
    }
  });

  $effect(() => {
    if (value !== undefined && markdownTextareaElement) {
      markdownTextareaElement.style.height = 'auto';
      markdownTextareaElement.style.height = `${markdownTextareaElement.scrollHeight}px`;
    }
  });

  function syncScroll() {
    if (markdownTextareaElement && preElement) {
      preElement.scrollTop = markdownTextareaElement.scrollTop;
      preElement.scrollLeft = markdownTextareaElement.scrollLeft;
    }
  }

  function updateLineHeights() {
    if (lineWrapMode !== 'soft') {
      lineHeights = [];
      return;
    }
    if (typeof document === 'undefined') return;
    tick().then(() => {
      if (!preElement) return;
      const lineEls =
        preElement.querySelectorAll<HTMLElement>('.editor-code-line');
      const heights: number[] = [];
      lineEls.forEach(el => {
        heights.push(el.offsetHeight || 24);
      });
      lineHeights = heights;
    });
  }

  $effect(() => {
    if (
      value !== undefined
      || lineWrapMode !== undefined
      || activeTab !== undefined
    ) {
      updateLineHeights();
    }
  });

  $effect(() => {
    if (value !== undefined) {
      renderMarkdown(value).then(html => {
        previewHtml = html;
      });
    }
  });

  $effect(() => {
    if (activeTab === 'preview' && previewHtml) {
      tick().then(() => {
        const blocks = document.querySelectorAll('.prose-custom pre code');
        blocks.forEach(block => {
          hljs.highlightElement(block as HTMLElement);
        });
        enhanceCodeBlocks(() => {});
      });
    }
  });

  function updateCursorPosition() {
    if (!markdownTextareaElement) return;
    const textBeforeCursor = (value || '').substring(
      0,
      markdownTextareaElement.selectionStart
    );
    const lines = textBeforeCursor.split('\n');
    currentLine = lines.length;
    currentColumn = lines[lines.length - 1].length + 1;
  }

  function handleTextareaKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const indentStr = indentMode === 'spaces' ? ' '.repeat(indentSize) : '\t';
      const val = value || '';
      value = val.substring(0, start) + indentStr + val.substring(end);
      tick().then(() => {
        target.selectionStart = target.selectionEnd = start + indentStr.length;
        syncScroll();
        updateCursorPosition();
      });
    }
  }

  export function insertMarkdown(prefix: string, suffix: string = '') {
    if (!markdownTextareaElement) return;
    const start = markdownTextareaElement.selectionStart;
    const end = markdownTextareaElement.selectionEnd;
    const val = value || '';
    const selectedText = val.substring(start, end);
    const replacement = prefix + selectedText + suffix;
    value = val.substring(0, start) + replacement + val.substring(end);
    tick().then(() => {
      markdownTextareaElement!.focus();
      markdownTextareaElement!.selectionStart = start + prefix.length;
      markdownTextareaElement!.selectionEnd =
        start + prefix.length + selectedText.length;
      syncScroll();
      updateCursorPosition();
    });
  }

  function handleImageClick() {
    if (onImageUpload) {
      imageFileInput?.click();
    } else {
      insertMarkdown('![', '](url)');
    }
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !onImageUpload) return;
    try {
      const url = await onImageUpload(file);
      if (url) {
        insertMarkdown(`![${file.name.replace(/\.[^/.]+$/, '')}](${url})`);
      }
    } catch {
    } finally {
      input.value = '';
    }
  }
</script>

<div
  class={cn(
    'relative flex flex-col rounded-md border border-border-subtle bg-surface-card text-left shadow-xl',
    className
  )}>
  <div
    bind:this={headerSentinelElement}
    class="pointer-events-none h-px w-full opacity-0"
    aria-hidden="true">
  </div>

  <div
    class="sticky {stickyTopClass} z-30 flex items-center border-b border-border-subtle bg-surface-card px-4 py-2.5 shadow-2xs transition-[border-radius,box-shadow] duration-150 select-none {(
      isHeaderStuck
    ) ?
      'rounded-none shadow-md'
    : 'rounded-t-md'}">
    <div
      class="inline-flex gap-0.5 rounded-sm border border-border-subtle bg-surface-switcher p-1">
      <button
        type="button"
        onclick={() => (activeTab = 'editor')}
        aria-pressed={activeTab === 'editor'}
        class="cursor-pointer rounded-sm px-4 py-1.5 text-xs font-bold transition-all {(
          activeTab === 'editor'
        ) ?
          'bg-copilot text-surface-base shadow-xs'
        : 'text-text-secondary hover:bg-surface-hover/30 hover:text-text-primary'}">
        Edit
      </button>
      <button
        type="button"
        onclick={() => (activeTab = 'preview')}
        aria-pressed={activeTab === 'preview'}
        class="cursor-pointer rounded-sm px-4 py-1.5 text-xs font-bold transition-all {(
          activeTab === 'preview'
        ) ?
          'bg-copilot text-surface-base shadow-xs'
        : 'text-text-secondary hover:bg-surface-hover/30 hover:text-text-primary'}">
        Preview
      </button>
    </div>

    {#if activeTab === 'editor'}
      <div class="ml-auto flex items-center gap-2 select-none">
        {#if autosaveKey}
          <div
            role="status"
            aria-live="polite"
            class="flex items-center pr-1.5 text-xs font-medium text-text-muted">
            {#if autoSaveStatus === 'saving'}
              <span class="inline-flex items-center gap-1.5">
                <svg
                  class="h-3.5 w-3.5 animate-spin text-text-muted"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true">
                  <circle
                    class="stroke-copilot stroke-3 opacity-25"
                    cx="12"
                    cy="12"
                    r="10"></circle>
                  <path
                    class="fill-copilot opacity-75"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving…
              </span>
            {:else}
              <span class="inline-flex items-center gap-1.5">
                <Check class="size-3.5 text-copilot" />
                Saved
              </span>
            {/if}
          </div>
        {/if}

        <div class="relative">
          <button
            type="button"
            onclick={() => {
              indentModeDropdownOpen = !indentModeDropdownOpen;
              indentSizeDropdownOpen = false;
              wrapModeDropdownOpen = false;
            }}
            class="inline-flex h-8 cursor-pointer items-center justify-between gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-3 text-xs font-medium text-text-primary shadow-2xs transition-all hover:border-border-subtle/80 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
            aria-haspopup="true"
            aria-expanded={indentModeDropdownOpen}>
            {indentMode === 'spaces' ? 'Spaces' : 'Tabs'}
            <span
              class="inline-flex h-3.5 w-3.5 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                indentModeDropdownOpen
              ) ?
                'rotate-180'
              : ''}">
              <ChevronDown class="size-3 leading-none" />
            </span>
          </button>
          {#if indentModeDropdownOpen}
            <button
              class="fixed inset-0 z-40 cursor-default"
              onclick={() => (indentModeDropdownOpen = false)}
              aria-label="Close menu"></button>
            <div
              role="menu"
              class="absolute top-8.5 right-0 z-50 flex min-w-30 flex-col rounded-sm border border-border-subtle bg-surface-elevated py-1 text-xs shadow-lg">
              {#each ['spaces', 'tabs'] as const as mode (mode)}
                <button
                  type="button"
                  role="menuitem"
                  onclick={() => {
                    indentMode = mode;
                    indentModeDropdownOpen = false;
                  }}
                  class="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover">
                  <span>{mode === 'spaces' ? 'Spaces' : 'Tabs'}</span>
                  {#if indentMode === mode}
                    <Check class="size-3.5 text-copilot" />
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="relative">
          <button
            type="button"
            onclick={() => {
              indentSizeDropdownOpen = !indentSizeDropdownOpen;
              indentModeDropdownOpen = false;
              wrapModeDropdownOpen = false;
            }}
            class="inline-flex h-8 cursor-pointer items-center justify-between gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-3 text-xs font-medium text-text-primary shadow-2xs transition-all hover:border-border-subtle/80 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
            aria-haspopup="true"
            aria-expanded={indentSizeDropdownOpen}>
            {indentSize}
            <span
              class="inline-flex h-3.5 w-3.5 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                indentSizeDropdownOpen
              ) ?
                'rotate-180'
              : ''}">
              <ChevronDown class="size-3 leading-none" />
            </span>
          </button>
          {#if indentSizeDropdownOpen}
            <button
              class="fixed inset-0 z-40 cursor-default"
              onclick={() => (indentSizeDropdownOpen = false)}
              aria-label="Close menu"></button>
            <div
              role="menu"
              class="absolute top-8.5 right-0 z-50 flex min-w-20 flex-col rounded-sm border border-border-subtle bg-surface-elevated py-1 text-xs shadow-lg">
              {#each [2, 4, 8] as size (size)}
                <button
                  type="button"
                  role="menuitem"
                  onclick={() => {
                    indentSize = size;
                    indentSizeDropdownOpen = false;
                  }}
                  class="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover">
                  <span>{size}</span>
                  {#if indentSize === size}
                    <Check class="size-3.5 text-copilot" />
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="relative">
          <button
            type="button"
            onclick={() => {
              wrapModeDropdownOpen = !wrapModeDropdownOpen;
              indentModeDropdownOpen = false;
              indentSizeDropdownOpen = false;
            }}
            class="inline-flex h-8 cursor-pointer items-center justify-between gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-3 text-xs font-medium text-text-primary shadow-2xs transition-all hover:border-border-subtle/80 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
            aria-haspopup="true"
            aria-expanded={wrapModeDropdownOpen}>
            {lineWrapMode === 'soft' ? 'Soft wrap' : 'No wrap'}
            <span
              class="inline-flex h-3.5 w-3.5 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                wrapModeDropdownOpen
              ) ?
                'rotate-180'
              : ''}">
              <ChevronDown class="size-3 leading-none" />
            </span>
          </button>
          {#if wrapModeDropdownOpen}
            <button
              class="fixed inset-0 z-40 cursor-default"
              onclick={() => (wrapModeDropdownOpen = false)}
              aria-label="Close menu"></button>
            <div
              role="menu"
              class="absolute top-8.5 right-0 z-50 flex min-w-30 flex-col rounded-sm border border-border-subtle bg-surface-elevated py-1 text-xs shadow-lg">
              {#each ['soft', 'none'] as const as mode (mode)}
                <button
                  type="button"
                  role="menuitem"
                  onclick={() => {
                    lineWrapMode = mode;
                    wrapModeDropdownOpen = false;
                  }}
                  class="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover">
                  <span>{mode === 'soft' ? 'Soft wrap' : 'No wrap'}</span>
                  {#if lineWrapMode === mode}
                    <Check class="size-3.5 text-copilot" />
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <div
    class="bg-surface-base"
    style={minHeight ? `min-height: ${minHeight};` : ''}>
    {#if activeTab === 'editor'}
      <div class="flex w-full flex-row items-stretch overflow-hidden">
        <div
          class="editor-line-numbers border-r border-border-subtle/20 bg-surface-card/10 pt-5 pb-5 select-none">
          {#each Array.from({length: lineCount}).keys() as i (i)}
            <div
              class="line-num-item pr-3.5 pl-4 text-right transition-colors {(
                currentLine === i + 1
              ) ?
                '-mr-px border-r-2 border-copilot bg-copilot/10 font-bold text-copilot'
              : 'text-text-muted/40'}"
              style={lineWrapMode === 'soft' && lineHeights[i] ?
                `height: ${lineHeights[i]}px !important;`
              : ''}>
              {i + 1}
            </div>
          {/each}
        </div>

        <div class="relative flex-1 overflow-hidden">
          <pre
            bind:this={preElement}
            class="editor-pre pointer-events-none absolute inset-0 m-0! box-border! w-full! scrollbar-none overflow-y-hidden! border-0! bg-transparent pt-5! pr-5! pb-5! pl-4! text-text-primary select-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden {(
              lineWrapMode === 'soft'
            ) ?
              'overflow-x-hidden! break-normal! wrap-break-word! whitespace-pre-wrap!'
            : 'overflow-x-auto! break-normal! whitespace-pre!'}"><code
              class="whitespace-inherit! break-inherit! overflow-wrap-inherit! language-markdown m-0! block! bg-transparent! p-0!"
              >{#each splitHighlightedHtmlLines(highlightedMarkdown) as lineHtml, i (i)}<div
                  class="editor-code-line whitespace-inherit! break-inherit! overflow-wrap-inherit! m-0! p-0!">{@html lineHtml}</div>{/each}</code></pre>

          <textarea
            bind:this={markdownTextareaElement}
            id="markdown-content"
            name="markdownContent"
            aria-label="Markdown content"
            {placeholder}
            bind:value
            onscroll={syncScroll}
            oninput={() => {
              syncScroll();
              updateCursorPosition();
            }}
            onclick={updateCursorPosition}
            onkeyup={updateCursorPosition}
            onfocus={updateCursorPosition}
            onkeydown={handleTextareaKeyDown}
            class="editor-textarea relative m-0! box-border! w-full! resize-none! overflow-y-hidden! border-0! bg-transparent pt-5! pr-5! pb-5! pl-4! text-transparent caret-text-primary placeholder:text-text-muted/60 focus:border-transparent! focus:shadow-none! focus:ring-0 focus:outline-none {(
              lineWrapMode === 'soft'
            ) ?
              'overflow-x-hidden! break-normal! wrap-break-word! whitespace-pre-wrap!'
            : 'overflow-x-auto! break-normal! whitespace-pre!'}"></textarea>
        </div>
      </div>
    {:else}
      <div class="prose-custom w-full bg-surface-base p-6">
        {#if previewHtml}
          {@html previewHtml}
        {:else}
          <p class="text-text-muted italic">Nothing to preview yet…</p>
        {/if}
      </div>
    {/if}
  </div>

  {#if activeTab === 'editor'}
    <div
      class="sticky bottom-0 z-30 flex flex-wrap items-center justify-between border-t border-border-subtle bg-surface-card px-3 py-1.5 text-xs text-text-secondary shadow-2xs transition-[border-radius,box-shadow] duration-150 select-none {(
        isToolbarStuck
      ) ?
        'rounded-none shadow-md'
      : 'rounded-b-md'}">
      <div
        class="flex items-center gap-1"
        role="toolbar"
        aria-label="Formatting tools">
        {#each [{action: () => insertMarkdown('# '), icon: Heading1, label: 'H1 heading'}, {action: () => insertMarkdown('## '), icon: Heading2, label: 'H2 heading'}, {action: () => insertMarkdown('### '), icon: Heading3, label: 'H3 heading'}] as const as item (item.label)}
          <button
            type="button"
            onclick={item.action}
            aria-label={item.label}
            class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
            <item.icon class="size-4" />
          </button>
        {/each}
        <div
          class="mx-1 h-4 w-px bg-border-subtle"
          aria-hidden="true">
        </div>
        {#each [{action: () => insertMarkdown('**', '**'), icon: Bold, label: 'Bold'}, {action: () => insertMarkdown('*', '*'), icon: Italic, label: 'Italic'}, {action: () => insertMarkdown('<u>', '</u>'), icon: Underline, label: 'Underline'}, {action: () => insertMarkdown('~~', '~~'), icon: Strikethrough, label: 'Strikethrough'}, {action: () => insertMarkdown('`', '`'), icon: Code, label: 'Inline code'}] as const as item (item.label)}
          <button
            type="button"
            onclick={item.action}
            aria-label={item.label}
            class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
            <item.icon class="size-4" />
          </button>
        {/each}
        <div
          class="mx-1 h-4 w-px bg-border-subtle"
          aria-hidden="true">
        </div>
        <button
          type="button"
          onclick={handleImageClick}
          aria-label="Insert image"
          class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
          <ImageIcon class="size-4" />
        </button>
        <input
          type="file"
          bind:this={imageFileInput}
          accept="image/png, image/webp, image/jpeg, image/jpg"
          onchange={handleFileSelected}
          class="hidden"
          aria-label="Upload image file" />
        {#each [{action: () => insertMarkdown('[', '](url)'), icon: LinkIcon, label: 'Insert link'}, {action: () => insertMarkdown('1. '), icon: ListOrdered, label: 'Numbered list'}, {action: () => insertMarkdown('- '), icon: List, label: 'Bulleted list'}, {action: () => insertMarkdown('- [ ] '), icon: ListTodo, label: 'Task list'}, {action: () => insertMarkdown('> '), icon: Quote, label: 'Blockquote'}] as const as item (item.label)}
          <button
            type="button"
            onclick={item.action}
            aria-label={item.label}
            class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
            <item.icon class="size-4" />
          </button>
        {/each}
        <div
          class="mx-1 h-4 w-px bg-border-subtle"
          aria-hidden="true">
        </div>
        {#each [{action: () => insertMarkdown('```\n', '\n```'), icon: SquareCode, label: 'Code block'}, {action: () => insertMarkdown('| Header 1 | Header 2 |\n|----------|----------|\n|  Cell 1  |  Cell 2  |\n'), icon: TableIcon, label: 'Add table'}, {action: () => insertMarkdown('\n---\n'), icon: Minus, label: 'Horizontal line'}] as const as item (item.label)}
          <button
            type="button"
            onclick={item.action}
            aria-label={item.label}
            class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
            <item.icon class="size-4" />
          </button>
        {/each}
      </div>

      <div class="flex items-center gap-4 font-mono text-xxs select-none">
        <span class="text-[12.5px] font-semibold tracking-wide"
          >{currentLine}:{currentColumn}</span>
        <span
          class="flex items-center gap-1 text-[12.5px] font-semibold tracking-wide">
          <Indent class="size-3.5" />
          {indentSize}
        </span>
        <span class="text-[12.5px] font-semibold tracking-wide">UTF-8</span>
        <span class="text-[12.5px] font-semibold tracking-wide"
          >{lineEnding}</span>
      </div>
    </div>
  {/if}
  <div
    bind:this={toolbarSentinelElement}
    class="pointer-events-none h-px w-full opacity-0"
    aria-hidden="true">
  </div>
</div>

<style>
  @reference "../../routes/global.css";
  .editor-textarea,
  .editor-pre,
  .editor-pre code,
  .editor-pre :global(span),
  .line-num-item {
    @apply font-mono text-[14.5px]! leading-[24px]! tracking-normal! normal-case!;
    font-feature-settings: var(--font-feature-settings-mono) !important;
  }

  .editor-textarea,
  .editor-pre {
    @apply break-words!;
    word-break: normal !important;
  }

  .editor-textarea {
    @apply m-0! box-border! border-0! outline-hidden!;
    background-color: transparent !important;
    background: transparent !important;
    caret-color: var(--color-text-primary) !important;
  }

  .editor-pre {
    color: var(--color-text-primary) !important;
  }

  .editor-textarea:focus-visible {
    @apply border-transparent! shadow-none! outline-hidden!;
    --tw-ring-shadow: none !important;
  }

  .editor-code-line {
    @apply block! min-h-[24px]! leading-[24px]!;
  }

  .line-num-item {
    @apply box-border! flex! h-[24px] items-start! justify-end!;
  }

  .prose-custom :global(h1),
  .prose-custom :global(h2),
  .prose-custom :global(h3) {
    @apply font-sans;
  }

  .prose-custom {
    @apply font-sans text-[0.9rem] leading-[1.7] text-(--color-body);
    --color-heading: var(--color-gh-gray-6);
    --color-body: var(--color-gh-gray-5);
    --color-link: var(--color-gh-gray-5);
    --color-link-hover: var(--color-copilot);
  }

  :global(:root.dark) .prose-custom {
    --color-heading: var(--color-gh-gray-1);
    --color-body: var(--color-gh-gray-3);
    --color-link: var(--color-gh-gray-3);
    --color-link-hover: var(--color-copilot);
  }

  .prose-custom :global(p) {
    @apply mt-5 mb-5 text-(--color-body);
  }

  .prose-custom :global(h1),
  .prose-custom :global(h2),
  .prose-custom :global(h3),
  .prose-custom :global(h4),
  .prose-custom :global(h5),
  .prose-custom :global(h6) {
    @apply text-(--color-heading);
  }

  .prose-custom :global(h1) {
    @apply mt-8 mb-4 text-3xl font-extrabold;
  }

  .prose-custom :global(h2) {
    @apply mt-7 mb-3 text-2xl font-bold;
  }

  .prose-custom :global(h3) {
    @apply mt-6 mb-2 text-xl font-semibold;
  }

  .prose-custom :global(pre) {
    @apply mt-6 mb-6 [scrollbar-width:none]! overflow-x-auto rounded-sm border border-border-subtle bg-surface-hover px-3! py-2! font-mono text-[0.8rem] leading-relaxed break-normal! whitespace-pre! [-ms-overflow-style:none]!;
  }

  .prose-custom :global(pre[data-enhanced='true']) {
    @apply pr-3.5! pl-2!;
  }

  .prose-custom :global(pre)::-webkit-scrollbar {
    @apply hidden! h-0! w-0!;
  }

  .prose-custom :global(code:not(pre code)) {
    @apply rounded bg-surface-hover px-1 py-px font-mono text-xs font-normal text-inherit;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .prose-custom :global(pre code) {
    @apply block! w-max! min-w-full! overflow-visible! border-0 bg-transparent py-0! pr-3.5! pl-0! font-mono text-[0.8rem] leading-relaxed break-normal! whitespace-pre! text-inherit;
  }

  .prose-custom :global(.code-line) {
    @apply block! w-full! pr-3.5!;
  }

  .prose-custom :global(pre.code-wrap .code-line),
  .prose-custom :global(pre[data-wrap='true'] .code-line) {
    padding-left: 4ch;
    text-indent: -4ch;
  }

  .prose-custom :global(a) {
    @apply text-(--color-link) underline;
  }

  .prose-custom :global(a):hover {
    @apply text-(--color-link-hover);
  }

  .prose-custom :global(.heading-text) {
    @apply inline! transition-none!;
  }

  .prose-custom :global(a.anchor-link) {
    @apply ml-[0.35rem]! inline-flex! items-center! justify-center! align-middle! leading-none! whitespace-nowrap! text-text-primary! no-underline! transition-none!;
  }

  :global(:root.dark) .prose-custom :global(a.anchor-link) {
    @apply text-gh-gray-4!;
  }

  .prose-custom :global(a.anchor-link svg) {
    @apply inline-block! align-middle! text-[0.85em]! leading-none! text-inherit! no-underline!;
  }

  .prose-custom :global(h1:hover .heading-text),
  .prose-custom :global(h2:hover .heading-text),
  .prose-custom :global(h3:hover .heading-text),
  .prose-custom :global(h4:hover .heading-text),
  .prose-custom :global(h5:hover .heading-text),
  .prose-custom :global(h6:hover .heading-text),
  .prose-custom :global(.heading-text):hover,
  :global(:root.dark) .prose-custom :global(h1:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h2:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h3:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h4:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h5:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h6:hover .heading-text),
  :global(:root.dark) .prose-custom :global(.heading-text):hover {
    @apply text-copilot underline underline-offset-4;
  }

  .prose-custom :global(h1:hover a.anchor-link),
  .prose-custom :global(h2:hover a.anchor-link),
  .prose-custom :global(h3:hover a.anchor-link),
  .prose-custom :global(h4:hover a.anchor-link),
  .prose-custom :global(h5:hover a.anchor-link),
  .prose-custom :global(h6:hover a.anchor-link),
  .prose-custom :global(a.anchor-link):hover,
  :global(:root.dark) .prose-custom :global(h1:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h2:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h3:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h4:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h5:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h6:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(a.anchor-link):hover,
  .prose-custom :global(h1:hover a.anchor-link svg),
  .prose-custom :global(h2:hover a.anchor-link svg),
  .prose-custom :global(h3:hover a.anchor-link svg),
  .prose-custom :global(h4:hover a.anchor-link svg),
  .prose-custom :global(h5:hover a.anchor-link svg),
  .prose-custom :global(h6:hover a.anchor-link svg),
  .prose-custom :global(a.anchor-link):hover :global(svg),
  :global(:root.dark) .prose-custom :global(h1:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h2:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h3:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h4:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h5:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h6:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(a.anchor-link):hover :global(svg) {
    @apply text-copilot! no-underline! opacity-100;
  }

  .prose-custom :global(table) {
    @apply my-6 w-full max-w-full table-fixed overflow-hidden rounded-sm border border-border-subtle text-left text-xs shadow-2xs;
    border-collapse: separate;
    border-spacing: 0;
  }

  .prose-custom :global(thead) {
    @apply border-b border-border-subtle bg-surface-hover/80 font-semibold tracking-wider text-text-primary uppercase;
  }

  .prose-custom :global(th) {
    @apply px-2.5 py-2 text-center font-semibold text-text-primary;
    overflow-wrap: break-word;
    word-break: break-word;
    width: 1%;
  }

  .prose-custom :global(tbody tr) {
    @apply transition-colors hover:bg-surface-hover/30;
  }

  .prose-custom :global(td) {
    @apply border-r border-border-subtle/40 px-2.5 py-1.5 text-left leading-relaxed text-text-secondary last:border-r-0;
    overflow-wrap: break-word;
    word-break: break-word;
    width: 1%;
  }

  .prose-custom :global(td code),
  .prose-custom :global(th code) {
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
  }

  .prose-custom :global(td[align='right']) {
    @apply text-right;
  }

  .prose-custom :global(td[align='center']) {
    @apply text-center;
  }

  .prose-custom :global(hr) {
    @apply my-8 h-px border-0 bg-border-default;
  }

  .prose-custom :global(blockquote:not(.markdown-alert)) {
    @apply my-6 rounded-l-none rounded-r-sm border-l-2 border-copilot bg-surface-hover/50 py-2.5 pr-4 pl-4 font-sans text-sm leading-relaxed text-text-secondary shadow-2xs;
  }

  .prose-custom :global(blockquote:not(.markdown-alert) p) {
    @apply my-1 text-text-secondary;
  }

  .prose-custom :global(ul:has(input[type='checkbox'])),
  .prose-custom :global(ol:has(input[type='checkbox'])) {
    @apply list-none! pl-0!;
  }

  .prose-custom :global(li:has(input[type='checkbox'])),
  .prose-custom :global(li.task-list-item) {
    @apply flex! list-none! items-center! gap-2.5! pl-0!;
  }

  .prose-custom :global(input[type='checkbox']) {
    appearance: none !important;
    -webkit-appearance: none !important;
    width: 1.125rem !important;
    height: 1.125rem !important;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 0.25rem;
    border: 1px solid var(--color-border-subtle);
    background-color: var(--color-surface-base);
    display: inline-grid;
    place-content: center;
    margin: 0;
    vertical-align: middle;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease;
  }

  .prose-custom :global(input[type='checkbox']:checked) {
    background-color: var(--color-copilot) !important;
    border-color: var(--color-copilot) !important;
  }

  .prose-custom :global(input[type='checkbox']:checked::before) {
    content: '';
    width: 0.625rem;
    height: 0.625rem;
    background-color: #ffffff;
    clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
  }

  .prose-custom :global(.markdown-alert) {
    @apply my-6 rounded-r-xl border-l-4 p-4 text-xs shadow-2xs transition-colors duration-200 sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-title) {
    @apply mb-1.5 flex items-center gap-2 text-xs font-bold select-none sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-content) {
    @apply leading-relaxed text-text-secondary;
  }

  .prose-custom :global(.markdown-alert-content > p) {
    @apply my-1 text-text-secondary;
  }

  .prose-custom :global(.markdown-alert-content > *:first-child) {
    @apply mt-0!;
  }

  .prose-custom :global(.markdown-alert-content > *:last-child) {
    @apply mb-0!;
  }

  .prose-custom :global(.markdown-alert-note) {
    @apply border-(--color-security) bg-(--color-security-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-note .markdown-alert-title) {
    @apply text-(--color-security);
  }

  .prose-custom :global(.markdown-alert-tip) {
    @apply border-(--color-success) bg-(--color-success-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-tip .markdown-alert-title) {
    @apply text-(--color-success);
  }

  .prose-custom :global(.markdown-alert-important) {
    @apply border-(--color-copilot) bg-(--color-copilot-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-important .markdown-alert-title) {
    @apply text-(--color-copilot);
  }

  .prose-custom :global(.markdown-alert-warning) {
    @apply border-(--color-warning) bg-(--color-warning-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-warning .markdown-alert-title) {
    @apply text-(--color-warning-strong);
  }

  .prose-custom :global(.markdown-alert-caution) {
    @apply border-(--color-danger) bg-(--color-danger-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-caution .markdown-alert-title) {
    @apply text-(--color-danger);
  }
  .prose-custom > :global(*:first-child) {
    @apply mt-0!;
  }
</style>
