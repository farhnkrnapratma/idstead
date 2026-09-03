<script lang="ts">
  import {onMount, tick} from 'svelte';
  import {
    Heading1,
    Heading2,
    Heading3,
    Heading4,
    Heading5,
    Heading6,
    Heading,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Code,
    Highlighter,
    Keyboard,
    Subscript,
    Superscript,
    Image as ImageIcon,
    Link2 as LinkIcon,
    ListOrdered,
    List,
    ListTodo,
    Quote,
    SquareCode,
    Table as TableIcon,
    Minus,
    ChevronsUpDown,
    Indent,
    ChevronDown,
    RulerDimensionLine,
    ArrowRightToLine,
    Space,
    Summary,
    TextWrap,
    TextAlignJustify,
    Bolt,
    RefreshCw,
    RefreshCwOff
  } from '@lucide/svelte';
  import {renderMarkdown} from '$lib/markdown';
  import {supabase} from '$lib/supabase';
  import {splitHighlightedHtmlLines} from '$lib/utils/codeBlocks';
  import {enhanceMarkdownContent} from '$lib/utils/markdownEnhancer';
  import 'katex/dist/katex.min.css';
  import hljs from 'highlight.js';
  import {
    applyCodeThemeVariables,
    ensureHljsThemeStylesheet
  } from '$lib/utils/codeBlocks';
  import {cn} from '$lib/utils/cn';
  import IconButton from './IconButton.svelte';
  import Tooltip from './Tooltip.svelte';
  import {themeStore} from '$lib/stores/themeStore.svelte';

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

  let headingDropdownOpen = $state(false);
  let overflowPopoverOpen = $state(false);
  let indentSizePopoverOpen = $state(false);
  let editorSettingsPopoverOpen = $state(false);

  let headingPopoverPos = $state({top: 0, left: 0});
  let overflowPopoverPos = $state({top: 0, left: 0});
  let indentSizePopoverPos = $state({top: 0, left: 0});
  let indentSizePopoverWidth = $state(0);
  let editorSettingsPopoverPos = $state({top: 0, right: 0});

  const EDITOR_PREFERENCES_STORAGE_KEY = 'markdown_editor_preferences';
  const INDENT_SIZES = [2, 4, 8] as const;
  type IndentSize = (typeof INDENT_SIZES)[number];
  type EditorPreferences = {
    indentMode: 'spaces' | 'tabs';
    indentSize: IndentSize;
    lineWrapMode: 'soft' | 'none';
    showLineNumbers: boolean;
    autosaveEnabled: boolean;
  };
  let showLineNumbers = $state(true);
  let autosaveEnabled = $state(true);
  let editorPreferencesReady = $state(false);

  onMount(() => {
    const preferences = readEditorPreferences();
    indentMode = preferences.indentMode;
    indentSize = preferences.indentSize;
    lineWrapMode = preferences.lineWrapMode;
    showLineNumbers = preferences.showLineNumbers;
    autosaveEnabled = preferences.autosaveEnabled;
    editorPreferencesReady = true;
  });

  function readEditorPreferences(): EditorPreferences {
    const defaults: EditorPreferences = {
      indentMode: 'spaces',
      indentSize: 4,
      lineWrapMode: 'soft',
      showLineNumbers: true,
      autosaveEnabled: true
    };
    try {
      const stored = localStorage.getItem(EDITOR_PREFERENCES_STORAGE_KEY);
      if (!stored) return defaults;
      const parsed: unknown = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object') return defaults;
      const preferences = parsed as Record<string, unknown>;
      return {
        indentMode:
          (
            preferences.indentMode === 'tabs'
            || preferences.indentMode === 'spaces'
          ) ?
            (preferences.indentMode as EditorPreferences['indentMode'])
          : defaults.indentMode,
        indentSize:
          (
            typeof preferences.indentSize === 'number'
            && INDENT_SIZES.includes(preferences.indentSize as IndentSize)
          ) ?
            (preferences.indentSize as IndentSize)
          : defaults.indentSize,
        lineWrapMode:
          (
            preferences.lineWrapMode === 'none'
            || preferences.lineWrapMode === 'soft'
          ) ?
            (preferences.lineWrapMode as EditorPreferences['lineWrapMode'])
          : defaults.lineWrapMode,
        showLineNumbers:
          typeof preferences.showLineNumbers === 'boolean' ?
            preferences.showLineNumbers
          : defaults.showLineNumbers,
        autosaveEnabled:
          typeof preferences.autosaveEnabled === 'boolean' ?
            preferences.autosaveEnabled
          : defaults.autosaveEnabled
      };
    } catch {
      return defaults;
    }
  }

  function persistEditorPreferences() {
    try {
      localStorage.setItem(
        EDITOR_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          indentMode,
          indentSize,
          lineWrapMode,
          showLineNumbers,
          autosaveEnabled
        })
      );
    } catch {}
  }

  function setIndentMode(mode: 'spaces' | 'tabs') {
    indentMode = mode;
    persistEditorPreferences();
  }

  function setIndentSize(size: IndentSize) {
    indentSize = size;
    persistEditorPreferences();
  }

  function setLineWrapMode(mode: 'soft' | 'none') {
    lineWrapMode = mode;
    persistEditorPreferences();
  }

  function setLineNumbers(show: boolean) {
    showLineNumbers = show;
    persistEditorPreferences();
  }

  function setAutosaveEnabled(enabled: boolean) {
    autosaveEnabled = enabled;
    persistEditorPreferences();
  }

  let currentLine = $state(1);
  let currentColumn = $state(1);

  let markdownTextareaElement = $state<HTMLTextAreaElement | null>(null);
  let preElement = $state<HTMLPreElement | null>(null);
  let editorElement = $state<HTMLDivElement | null>(null);
  let themeProbeElement = $state<HTMLSpanElement | null>(null);
  let imageFileInput = $state<HTMLInputElement | null>(null);

  let autoSaveTimer: ReturnType<typeof setTimeout>;

  const lineCount = $derived(
    (value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').length
  );
  const gutterWidth = $derived(
    showLineNumbers ?
      `calc(${Math.max(2, String(lineCount).length)}ch + 1.25rem)`
    : '0px'
  );
  const lineEnding = $derived((value || '').includes('\r\n') ? 'CRLF' : 'LF');
  const autosaveState = $derived(autosaveEnabled ? 'on' : 'off');
  const editorTheme = $derived<'light' | 'dark'>(
    themeStore.isDark ? 'dark' : 'light'
  );

  const highlightedMarkdown = $derived.by(() => {
    try {
      const code = value || '';
      const mathPlaceholders: {id: string; html: string}[] = [];
      let mathCounter = 0;

      let processed = code.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
        const id = `XQZMATHBLOCK${mathCounter++}XQZ`;
        const escaped = formula
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        mathPlaceholders.push({
          id,
          html: `<span class="hljs-formula">$$${escaped}$$</span>`
        });
        return id;
      });

      processed = processed.replace(
        /(?<!\$)\$([^$\n]+?)\$(?!\$)/g,
        (_, formula) => {
          const id = `XQZMATHINLINE${mathCounter++}XQZ`;
          const escaped = formula
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          mathPlaceholders.push({
            id,
            html: `<span class="hljs-formula">$${escaped}$</span>`
          });
          return id;
        }
      );

      let res = hljs.highlight(processed, {language: 'markdown'}).value;
      for (const item of mathPlaceholders) {
        res = res.replaceAll(item.id, item.html);
      }
      return res;
    } catch {
      return value || '';
    }
  });

  $effect(() => {
    clearTimeout(autoSaveTimer);
    if (!editorPreferencesReady) return;
    if (!autosaveEnabled || !autosaveKey || !value) return;
    autoSaveTimer = setTimeout(() => {
      const data = {content: value, timestamp: Date.now()};
      localStorage.setItem(autosaveKey, JSON.stringify(data));
    }, 500);

    return () => clearTimeout(autoSaveTimer);
  });

  function syncScroll() {
    if (markdownTextareaElement && preElement) {
      preElement.scrollTop = markdownTextareaElement.scrollTop;
      preElement.scrollLeft = markdownTextareaElement.scrollLeft;
    }
  }

  $effect(() => {
    if (value !== undefined) {
      renderMarkdown(value, undefined, supabase).then(html => {
        previewHtml = html;
      });
    }
  });

  $effect(() => {
    if (!editorElement || !themeProbeElement) return;
    let cancelled = false;
    ensureHljsThemeStylesheet(editorTheme).then(() => {
      if (!cancelled && editorElement && themeProbeElement) {
        applyCodeThemeVariables(editorElement, themeProbeElement);
      }
    });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (activeTab === 'preview' && previewHtml) {
      tick().then(() => {
        const blocks = document.querySelectorAll('.prose-custom pre code');
        blocks.forEach(block => {
          hljs.highlightElement(block as HTMLElement);
        });
        enhanceMarkdownContent({onCodeCopy: () => {}});
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

  function toggleAutosave() {
    setAutosaveEnabled(!autosaveEnabled);
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
      return;
    }

    if (
      e.key === 'Enter'
      && !e.shiftKey
      && !e.altKey
      && !e.ctrlKey
      && !e.metaKey
    ) {
      const target = e.currentTarget as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = value || '';
      const lastNewlineIndex = val.lastIndexOf('\n', start - 1);
      const lineStart = lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1;
      const lineText = val.substring(lineStart, start);

      const taskListMatch = lineText.match(/^(\s*)([-*+]\s+\[[ xX]\])\s*(.*)$/);
      const orderedListMatch = lineText.match(/^(\s*)(\d+)\.\s*(.*)$/);
      const bulletListMatch = lineText.match(/^(\s*)([-*+])\s*(.*)$/);
      const blockquoteMatch = lineText.match(/^(\s*)(>+)\s*(.*)$/);

      let continuation: string | null = null;
      let clearMarker = false;

      if (taskListMatch) {
        if (!taskListMatch[3].trim()) {
          clearMarker = true;
        } else {
          continuation = `\n${taskListMatch[1]}- [ ] `;
        }
      } else if (orderedListMatch) {
        if (!orderedListMatch[3].trim()) {
          clearMarker = true;
        } else {
          const num = parseInt(orderedListMatch[2], 10);
          continuation = `\n${orderedListMatch[1]}${num + 1}. `;
        }
      } else if (bulletListMatch) {
        if (!bulletListMatch[3].trim()) {
          clearMarker = true;
        } else {
          continuation = `\n${bulletListMatch[1]}${bulletListMatch[2]} `;
        }
      } else if (blockquoteMatch) {
        if (!blockquoteMatch[3].trim()) {
          clearMarker = true;
        } else {
          continuation = `\n${blockquoteMatch[1]}${blockquoteMatch[2]} `;
        }
      }

      if (clearMarker) {
        e.preventDefault();
        value = val.substring(0, lineStart) + val.substring(end);
        tick().then(() => {
          target.selectionStart = target.selectionEnd = lineStart;
          syncScroll();
          updateCursorPosition();
        });
        return;
      }

      if (continuation !== null) {
        e.preventDefault();
        value = val.substring(0, start) + continuation + val.substring(end);
        tick().then(() => {
          target.selectionStart = target.selectionEnd =
            start + continuation!.length;
          syncScroll();
          updateCursorPosition();
        });
        return;
      }
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
        const val = value || '';
        const existingImages = val.match(/!\[.*?\]\(/g) || [];
        const nextNum = existingImages.length + 1;
        insertMarkdown(`![Image ${nextNum}](${url})`);
      }
    } catch {
    } finally {
      input.value = '';
    }
  }

  function closeAllPopovers() {
    headingDropdownOpen = false;
    overflowPopoverOpen = false;
    indentSizePopoverOpen = false;
    editorSettingsPopoverOpen = false;
  }

  function openHeadingDropdown(el: HTMLButtonElement) {
    const rect = el.getBoundingClientRect();
    const popoverWidth = 140;
    const padding = 8;
    const clampedLeft = Math.max(
      padding,
      Math.min(rect.left, window.innerWidth - popoverWidth - padding)
    );
    const wasOpen = headingDropdownOpen;
    headingPopoverPos = {top: rect.bottom + 4, left: clampedLeft};
    closeAllPopovers();
    headingDropdownOpen = !wasOpen;
  }

  function openOverflowPopover(el: HTMLButtonElement) {
    const rect = el.getBoundingClientRect();
    const popoverWidth = 180;
    const padding = 8;
    const clampedLeft = Math.max(
      padding,
      Math.min(rect.left, window.innerWidth - popoverWidth - padding)
    );
    const wasOpen = overflowPopoverOpen;
    overflowPopoverPos = {top: rect.bottom + 4, left: clampedLeft};
    closeAllPopovers();
    overflowPopoverOpen = !wasOpen;
  }

  function toggleIndentSizePopover(el: HTMLButtonElement) {
    const rect = el.getBoundingClientRect();
    const padding = 8;
    const wasOpen = indentSizePopoverOpen;
    indentSizePopoverWidth = rect.width;
    indentSizePopoverPos = {
      top: rect.bottom + 4,
      left: Math.max(
        padding,
        Math.min(rect.left, window.innerWidth - rect.width - padding)
      )
    };
    closeAllPopovers();
    indentSizePopoverOpen = !wasOpen;
  }

  function toggleEditorSettingsPopover(el: HTMLButtonElement) {
    const rect = el.getBoundingClientRect();
    const padding = 8;
    const wasOpen = editorSettingsPopoverOpen;
    editorSettingsPopoverPos = {
      top: rect.bottom + 4,
      right: Math.max(padding, window.innerWidth - rect.right)
    };
    closeAllPopovers();
    editorSettingsPopoverOpen = !wasOpen;
  }

  function closeIndentSizePopover() {
    indentSizePopoverOpen = false;
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    closeAllPopovers();
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#snippet statusContent()}
  <div class="flex min-w-0 items-center gap-3 overflow-x-auto">
    <span class="editor-theme-foreground shrink-0"
      >Ln {currentLine}, Col {currentColumn}</span>
    <span class="flex shrink-0 items-center gap-1">
      <Indent class="hidden size-3 sm:inline-flex" />
      <span class="sm:hidden"
        >{indentMode === 'tabs' ? 'T' : `S: ${indentSize}`}</span>
      <span class="hidden sm:inline"
        >{indentMode === 'tabs' ? 'Tabs' : `Spaces: ${indentSize}`}</span>
    </span>
    <span class="shrink-0">UTF-8</span>
    <span class="shrink-0">{lineEnding}</span>
  </div>
  {#if autosaveKey}
    <div class="flex shrink-0 items-center gap-2">
      <div class="hidden items-center gap-2 sm:flex">
        <Tooltip content="Autosave: {autosaveState}">
          <button
            type="button"
            onclick={toggleAutosave}
            aria-pressed={autosaveEnabled}
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
            <span>Autosave</span>
          </button>
        </Tooltip>
        <span
          role="status"
          aria-live="polite">[{autosaveState}]</span>
      </div>
      <Tooltip content="Autosave: {autosaveState}">
        <button
          type="button"
          onclick={toggleAutosave}
          aria-pressed={autosaveEnabled}
          aria-label="Autosave: {autosaveState}"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:hidden">
          {#if autosaveEnabled}
            <RefreshCw class="size-3" />
          {:else}
            <RefreshCwOff class="size-3" />
          {/if}
        </button>
      </Tooltip>
      <Tooltip content="Styling with Markdown is supported">
        <button
          type="button"
          onclick={() => markdownTextareaElement?.focus()}
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
          <i
            class="bi bi-markdown-fill inline-flex size-3 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
            aria-hidden="true"></i>
          <span class="hidden sm:inline">Markdown</span>
        </button>
      </Tooltip>
    </div>
  {/if}
{/snippet}

<div
  bind:this={editorElement}
  data-code-theme={editorTheme}
  style:--editor-min-height={minHeight}
  class={cn(
    'editor-shell relative flex min-h-0 flex-col rounded-sm border text-left shadow-xl',
    className
  )}>
  <span
    bind:this={themeProbeElement}
    class="editor-theme-probe hljs"
    aria-hidden="true"></span>
  <div
    class="editor-header sticky {stickyTopClass} z-30 flex flex-col rounded-t-sm shadow-md">
    <div
      class="editor-chrome flex min-h-10 items-center rounded-t-sm border-b px-2 py-1 shadow-2xs select-none sm:px-3">
      <div class="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <div
          class="editor-tab-list flex h-8 min-w-0 items-center rounded-sm border p-0.5"
          role="tablist"
          aria-label="Markdown editor views">
          <button
            type="button"
            onclick={() => (activeTab = 'editor')}
            role="tab"
            aria-selected={activeTab === 'editor'}
            class="editor-tab inline-flex h-full cursor-pointer items-center rounded-xs px-3 font-mono text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none sm:px-4 {(
              activeTab === 'editor'
            ) ?
              'editor-tab-active'
            : 'editor-tab-inactive'}">
            Edit
          </button>
          <button
            type="button"
            onclick={() => (activeTab = 'preview')}
            role="tab"
            aria-selected={activeTab === 'preview'}
            class="editor-tab inline-flex h-full cursor-pointer items-center rounded-xs px-3 font-mono text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none sm:px-4 {(
              activeTab === 'preview'
            ) ?
              'editor-tab-active'
            : 'editor-tab-inactive'}">
            Preview
          </button>
        </div>

        {#if activeTab === 'editor'}
          <div class="ml-auto hidden items-center gap-1 select-none sm:flex">
            <IconButton
              ariaLabel="Indent mode: {indentMode === 'spaces' ? 'Spaces' : (
                'Tabs'
              )}"
              tooltip="Indent mode: {indentMode === 'spaces' ? 'Spaces' : (
                'Tabs'
              )}"
              size="sm"
              class="editor-control-button"
              onclick={() =>
                setIndentMode(indentMode === 'spaces' ? 'tabs' : 'spaces')}>
              {#if indentMode === 'spaces'}
                <Space class="size-3.5" />
              {:else}
                <ArrowRightToLine class="size-3.5" />
              {/if}
            </IconButton>
            <IconButton
              ariaLabel="Indent size: {indentSize} spaces"
              tooltip="Indent size: {indentSize}"
              size="sm"
              class="editor-control-button"
              aria-haspopup="listbox"
              aria-expanded={indentSizePopoverOpen}
              onclick={event =>
                toggleIndentSizePopover(
                  event.currentTarget as HTMLButtonElement
                )}>
              <RulerDimensionLine class="size-3.5" />
            </IconButton>
            <IconButton
              ariaLabel="Line wrapping: {lineWrapMode === 'soft' ? 'Wrap' : (
                'Nowrap'
              )}"
              tooltip="Line wrapping: {lineWrapMode === 'soft' ? 'Wrap' : (
                'Nowrap'
              )}"
              size="sm"
              class="editor-control-button"
              onclick={() =>
                setLineWrapMode(lineWrapMode === 'soft' ? 'none' : 'soft')}>
              {#if lineWrapMode === 'soft'}
                <TextWrap class="size-3.5" />
              {:else}
                <Summary class="size-3.5" />
              {/if}
            </IconButton>
            <IconButton
              ariaLabel="Line numbers: {showLineNumbers ? 'on' : 'off'}"
              tooltip="Line numbers: {showLineNumbers ? 'on' : 'off'}"
              size="sm"
              class="editor-control-button"
              onclick={() => setLineNumbers(!showLineNumbers)}>
              {#if showLineNumbers}
                <ListOrdered class="size-3.5" />
              {:else}
                <TextAlignJustify class="size-3.5" />
              {/if}
            </IconButton>
          </div>

          <div class="ml-auto flex items-center select-none sm:hidden">
            <IconButton
              ariaLabel="Editor settings"
              tooltip="Editor settings"
              size="sm"
              class="editor-control-button"
              aria-haspopup="true"
              aria-expanded={editorSettingsPopoverOpen}
              onclick={event =>
                toggleEditorSettingsPopover(
                  event.currentTarget as HTMLButtonElement
                )}>
              <Bolt class="size-3.5" />
            </IconButton>
          </div>
        {/if}
      </div>
    </div>

    {#if activeTab === 'editor'}
      <div
        class="editor-chrome editor-toolbar flex min-h-10 items-stretch border-b p-0 text-xs select-none">
        <div
          class="editor-toolbar-scroll flex min-w-0 flex-1 scrollbar-none items-center gap-1 overflow-x-auto px-2 py-1.5 sm:px-3"
          role="toolbar"
          aria-label="Formatting tools">
          {#each [{action: () => insertMarkdown('# '), icon: Heading1, label: 'H1 heading'}, {action: () => insertMarkdown('## '), icon: Heading2, label: 'H2 heading'}, {action: () => insertMarkdown('### '), icon: Heading3, label: 'H3 heading'}] as const as item (item.label)}
            <button
              type="button"
              onclick={item.action}
              aria-label={item.label}
              class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
              <item.icon class="size-4" />
            </button>
          {/each}

          <button
            type="button"
            onclick={e =>
              openHeadingDropdown(e.currentTarget as HTMLButtonElement)}
            aria-label="More headings (H4-H6)"
            aria-haspopup="true"
            aria-expanded={headingDropdownOpen}
            class="flex h-7 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-sm px-1 transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
            <Heading class="size-4" />
            <ChevronDown
              class="size-3 transition-transform duration-200 {(
                headingDropdownOpen
              ) ?
                'rotate-180'
              : ''}" />
          </button>

          <div
            class="mx-1 h-4 w-px shrink-0 bg-border-subtle"
            aria-hidden="true">
          </div>

          {#each [{action: () => insertMarkdown('**', '**'), icon: Bold, label: 'Bold'}, {action: () => insertMarkdown('*', '*'), icon: Italic, label: 'Italic'}, {action: () => insertMarkdown('<u>', '</u>'), icon: Underline, label: 'Underline'}, {action: () => insertMarkdown('~~', '~~'), icon: Strikethrough, label: 'Strikethrough'}, {action: () => insertMarkdown('`', '`'), icon: Code, label: 'Inline code'}] as const as item (item.label)}
            <button
              type="button"
              onclick={item.action}
              aria-label={item.label}
              class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
              <item.icon class="size-4" />
            </button>
          {/each}

          <div
            class="mx-1 h-4 w-px shrink-0 bg-border-subtle"
            aria-hidden="true">
          </div>

          <button
            type="button"
            onclick={handleImageClick}
            aria-label="Insert image"
            class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
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
              class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
              <item.icon class="size-4" />
            </button>
          {/each}

          <div
            class="mx-1 h-4 w-px shrink-0 bg-border-subtle"
            aria-hidden="true">
          </div>

          <button
            type="button"
            onclick={() => insertMarkdown('```\n', '\n```')}
            aria-label="Code block"
            class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
            <SquareCode class="size-4" />
          </button>

          <div
            class="mx-1 h-4 w-px shrink-0 bg-border-subtle"
            aria-hidden="true">
          </div>

          <button
            type="button"
            onclick={e =>
              openOverflowPopover(e.currentTarget as HTMLButtonElement)}
            aria-label="More formatting options"
            aria-haspopup="true"
            aria-expanded={overflowPopoverOpen}
            class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
            <span class="text-sm leading-none font-bold tracking-widest"
              >···</span>
          </button>
        </div>
      </div>
    {/if}
  </div>

  <div
    class="editor-surface flex-1 font-mono"
    style:min-height={minHeight || undefined}
    style:--editor-tab-size={indentSize}
    style:--editor-gutter-width={gutterWidth}>
    {#if activeTab === 'editor'}
      {#if lineWrapMode === 'none'}
        <div
          class="editor-lines relative flex min-h-full w-full flex-row font-mono"
          style:min-height={minHeight || undefined}>
          {#if showLineNumbers}
            <div
              class="editor-gutter-track pointer-events-none sticky left-0 z-10 box-border flex shrink-0 flex-col border-r border-border-subtle bg-surface-base font-mono text-[14.5px] select-none"
              style:width="var(--editor-gutter-width)"
              style:min-width="var(--editor-gutter-width)"
              style:max-width="var(--editor-gutter-width)"
              aria-hidden="true">
              {#each {length: lineCount} as _, i (i)}
                <div
                  class={cn(
                    'editor-gutter-num box-border flex items-start justify-center px-1 text-center font-mono leading-6 tabular-nums select-none',
                    currentLine === i + 1 ?
                      'editor-line-number-active font-medium'
                    : 'editor-gutter-muted'
                  )}>
                  {i + 1}
                </div>
              {/each}
            </div>
          {/if}
          <div
            class="relative grid min-h-full min-w-0 flex-1 overflow-hidden [grid-template-areas:'editor']">
            <pre
              bind:this={preElement}
              data-code-theme={editorTheme}
              class="editor-pre pointer-events-none m-0! box-border! min-h-full! w-full! scrollbar-none overflow-x-auto! overflow-y-hidden! border-0! bg-transparent pt-0! pr-5! pb-5! pl-2! break-normal! [overflow-wrap:normal]! [word-break:normal]! whitespace-pre! select-none [-ms-overflow-style:none] [grid-area:editor] [&::-webkit-scrollbar]:hidden"><code
                class="hljs language-markdown m-0! block! w-max! min-w-full! overflow-x-visible! p-0! [overflow-wrap:normal]! [word-break:normal]! [white-space:pre]!"
                data-code-theme={editorTheme}
                >{#each splitHighlightedHtmlLines(highlightedMarkdown) as lineHtml, i (i)}<div
                    class={cn(
                      'editor-code-line m-0! block! w-max! min-w-full! leading-6! [overflow-wrap:normal]! [word-break:normal]! [white-space:pre]!',
                      currentLine === i + 1 && 'editor-code-line-active'
                    )}>{@html lineHtml || '&nbsp;'}</div>{/each}</code></pre>

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
              class="editor-textarea m-0! box-border! h-full! min-h-full! w-full! resize-none! overflow-x-auto! overflow-y-hidden! border-0! bg-transparent! pt-0! pr-5! pb-5! pl-2! break-normal! [overflow-wrap:normal]! [word-break:normal]! whitespace-pre! text-transparent caret-text-primary outline-hidden! [grid-area:editor] placeholder:text-text-muted/60 focus:border-transparent! focus:shadow-none! focus:ring-0 focus:outline-none focus-visible:border-transparent! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:outline-hidden!"
            ></textarea>
          </div>
        </div>
      {:else}
        <div
          class="editor-lines relative flex min-h-full w-full flex-col font-mono"
          style:min-height={minHeight || undefined}>
          {#if showLineNumbers}
            <div
              class="editor-gutter-track pointer-events-none absolute inset-y-0 left-0 z-10 box-border border-r font-mono text-[14.5px]"
              style:width="var(--editor-gutter-width)"
              style:min-width="var(--editor-gutter-width)"
              style:max-width="var(--editor-gutter-width)"
              aria-hidden="true">
            </div>
          {/if}
          <div
            class="relative grid min-h-full w-full [grid-template-areas:'editor']">
            <pre
              bind:this={preElement}
              data-code-theme={editorTheme}
              class="editor-pre pointer-events-none m-0! box-border! min-h-full! w-full! scrollbar-none overflow-hidden! border-0! bg-transparent pt-0! pr-0! pb-5! pl-0! break-normal! wrap-break-word! whitespace-pre-wrap! select-none [-ms-overflow-style:none] [grid-area:editor] [&::-webkit-scrollbar]:hidden"><code
                class="hljs language-markdown m-0! block! w-full! min-w-full! overflow-x-visible! p-0! [overflow-wrap:inherit]! [word-break:inherit]! [white-space:inherit]!"
                data-code-theme={editorTheme}
                >{#each splitHighlightedHtmlLines(highlightedMarkdown) as lineHtml, i (i)}<div
                    class={cn(
                      'editor-code-line m-0! flex! w-full! flex-row! items-stretch! p-0! leading-6! [overflow-wrap:inherit]! [word-break:inherit]! [white-space:inherit]!',
                      currentLine === i + 1 && 'editor-code-line-active'
                    )}>{#if showLineNumbers}<span
                        class={cn(
                          'editor-gutter-num sticky left-0 z-20 box-border! inline-flex! shrink-0! items-start! justify-center! self-stretch! border-r px-1 text-center font-mono tabular-nums select-none',
                          currentLine === i + 1 ?
                            'editor-line-number-active font-medium'
                          : 'editor-gutter-muted'
                        )}
                        style:width="var(--editor-gutter-width)"
                        style:min-width="var(--editor-gutter-width)"
                        style:max-width="var(--editor-gutter-width)"
                        >{i + 1}</span
                      >{/if}<span
                      class="editor-line-content m-0! block! min-w-0! flex-1! pt-0! pr-5! pb-0! pl-2! leading-6! [overflow-wrap:inherit]! [word-break:inherit]! [white-space:inherit]!"
                      >{@html lineHtml
                        || '&nbsp;'}</span></div>{/each}</code></pre>

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
              class="editor-textarea m-0! box-border! h-full! min-h-full! w-full! resize-none! overflow-hidden! border-0! bg-transparent! pt-0! pr-5! pb-5! break-normal! wrap-break-word! whitespace-pre-wrap! text-transparent caret-text-primary outline-hidden! [grid-area:editor] placeholder:text-text-muted/60 focus:border-transparent! focus:shadow-none! focus:ring-0 focus:outline-none focus-visible:border-transparent! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:outline-hidden!"
              style:padding-left={showLineNumbers ?
                'calc(var(--editor-gutter-width) + 0.5rem)'
              : '0.5rem'}></textarea>
          </div>
        </div>
      {/if}
    {:else}
      <div
        class="prose-custom editor-surface w-full p-6"
        style:min-height={minHeight || undefined}>
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
      class="editor-chrome editor-status-bar sticky bottom-0 z-20 flex min-h-8 items-center justify-between gap-3 rounded-b-sm border-t px-3 font-mono text-xxs select-none sm:px-4">
      {@render statusContent()}
    </div>
  {/if}

  {#if indentSizePopoverOpen}
    <button
      class="fixed inset-0 z-40 cursor-default"
      onclick={closeIndentSizePopover}
      tabindex="-1"
      aria-label="Close indent size menu"></button>
    <div
      role="listbox"
      class="editor-control-menu fixed z-50 flex flex-col overflow-hidden rounded-sm border p-0 text-xs shadow-xl"
      aria-label="Indent size"
      style="top:{indentSizePopoverPos.top}px; left:{indentSizePopoverPos.left}px; width:{indentSizePopoverWidth}px">
      {#each INDENT_SIZES as size (size)}
        <button
          type="button"
          role="option"
          aria-selected={indentSize === size}
          onclick={() => {
            setIndentSize(size);
            closeIndentSizePopover();
          }}
          class={cn(
            'editor-control-option flex w-full items-center justify-center',
            indentSize === size && 'editor-control-option-active'
          )}>
          {size}
        </button>
      {/each}
    </div>
  {/if}

  {#if editorSettingsPopoverOpen}
    <button
      class="fixed inset-0 z-40 cursor-default"
      onclick={() => (editorSettingsPopoverOpen = false)}
      tabindex="-1"
      aria-label="Close editor settings menu"></button>
    <div
      class="editor-control-menu fixed z-50 flex max-w-[calc(100vw-1rem)] min-w-56 flex-col overflow-hidden rounded-sm border p-1 text-xs shadow-xl"
      aria-label="Editor settings"
      style="top:{editorSettingsPopoverPos.top}px; right:{editorSettingsPopoverPos.right}px">
      <div class="flex items-center justify-between gap-3 px-2 py-1.5">
        <span class="editor-control-row-label">Indent mode</span>
        <IconButton
          ariaLabel="Indent mode: {indentMode === 'spaces' ? 'Spaces' : 'Tabs'}"
          size="xs"
          class="editor-control-button"
          onclick={() =>
            setIndentMode(indentMode === 'spaces' ? 'tabs' : 'spaces')}>
          {#if indentMode === 'spaces'}
            <Space class="size-3.5" />
          {:else}
            <ArrowRightToLine class="size-3.5" />
          {/if}
        </IconButton>
      </div>
      <div class="flex items-center justify-between gap-3 px-2 py-1.5">
        <span class="editor-control-row-label">Indent size</span>
        <div class="flex items-center gap-1">
          {#each INDENT_SIZES as size (size)}
            <button
              type="button"
              aria-pressed={indentSize === size}
              onclick={() => setIndentSize(size)}
              class={cn(
                'editor-control-option inline-flex items-center justify-center rounded-sm px-2.5 py-1',
                indentSize === size && 'editor-control-option-active'
              )}>
              {size}
            </button>
          {/each}
        </div>
      </div>
      <div class="flex items-center justify-between gap-3 px-2 py-1.5">
        <span class="editor-control-row-label">Line wrapping</span>
        <IconButton
          ariaLabel="Line wrapping: {lineWrapMode === 'soft' ? 'Wrap' : (
            'Nowrap'
          )}"
          size="xs"
          class="editor-control-button"
          onclick={() =>
            setLineWrapMode(lineWrapMode === 'soft' ? 'none' : 'soft')}>
          {#if lineWrapMode === 'soft'}
            <TextWrap class="size-3.5" />
          {:else}
            <Summary class="size-3.5" />
          {/if}
        </IconButton>
      </div>
      <div class="flex items-center justify-between gap-3 px-2 py-1.5">
        <span class="editor-control-row-label">Line numbers</span>
        <IconButton
          ariaLabel="Line numbers: {showLineNumbers ? 'on' : 'off'}"
          size="xs"
          class="editor-control-button"
          onclick={() => setLineNumbers(!showLineNumbers)}>
          {#if showLineNumbers}
            <ListOrdered class="size-3.5" />
          {:else}
            <TextAlignJustify class="size-3.5" />
          {/if}
        </IconButton>
      </div>
    </div>
  {/if}
</div>

{#if headingDropdownOpen}
  <button
    class="fixed inset-0 z-40 cursor-default"
    onclick={() => (headingDropdownOpen = false)}
    aria-label="Close heading menu"></button>
  <div
    role="menu"
    class="editor-control-menu fixed z-50 flex min-w-32 flex-col overflow-hidden rounded-sm border p-0 text-xs shadow-xl"
    style="top:{headingPopoverPos.top}px; left:{headingPopoverPos.left}px">
    <button
      type="button"
      role="menuitem"
      onclick={() => {
        insertMarkdown('#### ');
        headingDropdownOpen = false;
      }}
      class="editor-control-option flex w-full cursor-pointer items-center gap-2 text-left font-sans-title text-xs font-medium">
      <Heading4 class="size-4" />
      <span>Heading 4</span>
    </button>
    <button
      type="button"
      role="menuitem"
      onclick={() => {
        insertMarkdown('##### ');
        headingDropdownOpen = false;
      }}
      class="editor-control-option flex w-full cursor-pointer items-center gap-2 text-left font-sans-title text-xs font-medium">
      <Heading5 class="size-4" />
      <span>Heading 5</span>
    </button>
    <button
      type="button"
      role="menuitem"
      onclick={() => {
        insertMarkdown('###### ');
        headingDropdownOpen = false;
      }}
      class="editor-control-option flex w-full cursor-pointer items-center gap-2 text-left font-sans-title text-xs font-medium">
      <Heading6 class="size-4" />
      <span>Heading 6</span>
    </button>
  </div>
{/if}

{#if overflowPopoverOpen}
  <button
    class="fixed inset-0 z-40 cursor-default"
    onclick={() => (overflowPopoverOpen = false)}
    aria-label="Close more options menu"></button>
  <div
    role="menu"
    class="editor-control-menu fixed z-50 flex max-w-[calc(100vw-1rem)] min-w-44 flex-col overflow-hidden rounded-sm border p-0 text-xs shadow-xl"
    style="top:{overflowPopoverPos.top}px; left:{overflowPopoverPos.left}px">
    {#each [{action: () => insertMarkdown('<kbd>', '</kbd>'), icon: Keyboard, label: 'Keyboard key'}, {action: () => insertMarkdown('<mark>', '</mark>'), icon: Highlighter, label: 'Highlight'}, {action: () => insertMarkdown('<sub>', '</sub>'), icon: Subscript, label: 'Subscript'}, {action: () => insertMarkdown('<sup>', '</sup>'), icon: Superscript, label: 'Superscript'}, {action: () => insertMarkdown('| Header 1 | Header 2 |\n|----------|-----------|\n|  Cell 1  |  Cell 2  |\n'), icon: TableIcon, label: 'Add table'}, {action: () => insertMarkdown('<details>\n<summary>Details</summary>\n\n', '\n</details>\n'), icon: ChevronsUpDown, label: 'Collapsible details'}, {action: () => insertMarkdown('\n---\n'), icon: Minus, label: 'Horizontal rule'}] as const as item (item.label)}
      <button
        type="button"
        role="menuitem"
        onclick={() => {
          item.action();
          overflowPopoverOpen = false;
        }}
        class="editor-control-option flex w-full cursor-pointer items-center gap-2 text-left font-sans-title text-xs font-medium">
        <item.icon class="size-4 shrink-0" />
        <span>{item.label}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  @reference "../../routes/global.css";

  .editor-shell {
    background-color: var(--code-theme-bg);
    border-color: var(--code-theme-border);
    color: var(--code-theme-fg);
  }

  .editor-header {
    background-color: color-mix(
      in srgb,
      var(--code-theme-bg) 96%,
      var(--code-theme-fg)
    );
  }

  .editor-chrome {
    background-color: color-mix(
      in srgb,
      var(--code-theme-bg) 96%,
      var(--code-theme-fg)
    );
    border-color: var(--code-theme-border);
    color: var(--code-theme-muted);
  }

  .editor-surface {
    --editor-line-height: 1.5rem;
    background-color: var(--code-theme-bg);
    color: var(--code-theme-fg);
  }

  .editor-lines {
    min-height: 100%;
  }

  .editor-gutter {
    background-color: var(--code-theme-bg);
    border-color: var(--code-theme-border);
  }

  .editor-theme-probe {
    display: none;
  }

  .editor-theme-foreground {
    color: var(--code-theme-fg);
  }

  .editor-theme-muted {
    color: var(--code-theme-muted);
  }

  .editor-tab {
    color: var(--code-theme-muted);
  }

  .editor-tab-list,
  .editor-toolbar {
    border-color: var(--code-theme-border);
  }

  .editor-tab-active {
    background-color: color-mix(
      in srgb,
      var(--code-theme-fg) 14%,
      var(--code-theme-bg)
    );
    color: var(--code-theme-fg);
  }

  .editor-tab-inactive:hover {
    background-color: color-mix(in srgb, var(--code-theme-fg) 6%, transparent);
    color: var(--code-theme-fg);
  }

  .editor-gutter-track,
  .editor-gutter-num,
  .editor-textarea,
  .editor-pre,
  .editor-pre code,
  .editor-pre :global(span) {
    @apply font-mono text-[14.5px]! leading-6! tracking-normal! normal-case!;
  }

  .editor-code-line,
  .editor-gutter-num {
    min-height: var(--editor-line-height) !important;
    line-height: var(--editor-line-height) !important;
  }

  .editor-gutter-track,
  .editor-gutter-num,
  .editor-gutter-muted {
    background-color: var(--code-theme-bg);
    border-color: var(--code-theme-border);
  }

  .editor-gutter-muted {
    color: var(--code-theme-muted);
  }

  .editor-textarea,
  .editor-pre,
  .editor-pre code {
    tab-size: var(--editor-tab-size);
  }

  .editor-textarea,
  .editor-textarea:focus {
    caret-color: var(--code-theme-fg);
  }

  :global(.editor-control-button) {
    background-color: color-mix(
      in srgb,
      var(--code-theme-bg) 88%,
      var(--code-theme-fg)
    );
    border-color: var(--code-theme-border);
    color: var(--code-theme-muted);
  }

  :global(.editor-control-button:hover),
  :global(.editor-control-button[aria-expanded='true']) {
    background-color: color-mix(
      in srgb,
      var(--code-theme-fg) 14%,
      var(--code-theme-bg)
    );
    border-color: var(--code-theme-border);
    color: var(--code-theme-fg);
  }

  :global(.editor-control-button:focus-visible) {
    border-color: var(--code-theme-border);
  }

  .editor-control-menu {
    background-color: var(--code-theme-bg);
    border-color: var(--code-theme-border);
    color: var(--code-theme-fg);
  }

  .editor-control-option {
    color: var(--code-theme-muted);
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    text-align: left;
    transition:
      background-color 150ms,
      color 150ms;
  }

  .editor-control-option:hover,
  .editor-control-option:focus-visible {
    background-color: color-mix(
      in srgb,
      var(--code-theme-fg) 14%,
      var(--code-theme-bg)
    );
    color: var(--code-theme-fg);
    outline: none;
  }

  .editor-control-option-active,
  .editor-control-option-active:hover {
    background-color: color-mix(
      in srgb,
      var(--code-theme-fg) 8%,
      var(--code-theme-bg)
    );
    color: var(--code-theme-fg);
  }

  .editor-control-row-label {
    color: var(--code-theme-muted);
  }

  .editor-toolbar-scroll {
    background-image:
      linear-gradient(to left, var(--code-theme-bg) 0%, transparent 100%),
      linear-gradient(
        to left,
        color-mix(in srgb, var(--code-theme-fg) 8%, transparent) 0%,
        transparent 100%
      );
    background-repeat: no-repeat;
    background-position:
      100% 0,
      100% 0;
    background-size:
      28px 100%,
      20px 100%;
    background-attachment: local, scroll;
  }

  @media (min-width: 40rem) {
    .editor-toolbar-scroll {
      background-image: none;
    }
  }

  .editor-line-number-active {
    background-color: var(--code-theme-bg);
    border-color: var(--code-theme-border);
    color: var(--code-theme-fg) !important;
  }

  .editor-code-line-active {
    background-color: color-mix(
      in srgb,
      var(--code-theme-fg) 8%,
      var(--code-theme-bg)
    );
  }

  .editor-code-line-active .editor-gutter-num {
    background-color: color-mix(
      in srgb,
      var(--code-theme-fg) 8%,
      var(--code-theme-bg)
    );
  }

  .prose-custom :global(h1),
  .prose-custom :global(h2),
  .prose-custom :global(h3) {
    @apply font-sans;
  }

  .prose-custom {
    @apply font-sans text-[0.9rem] leading-[1.7] text-text-secondary;
  }

  .prose-custom :global(p) {
    @apply mt-5 mb-5 text-text-secondary;
  }

  .prose-custom :global(h1),
  .prose-custom :global(h2),
  .prose-custom :global(h3),
  .prose-custom :global(h4),
  .prose-custom :global(h5),
  .prose-custom :global(h6) {
    @apply font-sans text-text-primary;
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

  .prose-custom :global(h4) {
    @apply mt-5 mb-2 text-lg font-semibold;
  }

  .prose-custom :global(h5) {
    @apply mt-4 mb-2 text-base font-semibold;
  }

  .prose-custom :global(h6) {
    @apply mt-4 mb-2 text-sm font-semibold;
  }

  .prose-custom :global(pre) {
    @apply mt-6 mb-6 scrollbar-none! overflow-x-auto rounded-sm border border-border-subtle bg-surface-hover px-3! py-1.5! font-mono text-[0.8rem] leading-snug break-normal! whitespace-pre! [-ms-overflow-style:none]!;
  }

  .prose-custom :global(pre[data-enhanced='true']) {
    @apply pt-0! pr-0! pl-0!;
  }

  .prose-custom :global(pre)::-webkit-scrollbar {
    @apply hidden! h-0! w-0!;
  }

  .prose-custom :global(code:not(pre code)) {
    @apply rounded bg-code-inline-bg px-0.5 py-px font-mono text-[0.925em] font-normal wrap-break-word [word-break:break-word] text-inherit;
  }

  .prose-custom :global(pre code) {
    @apply block! w-max! min-w-full! overflow-visible! border-0 bg-transparent py-0! pr-0! pl-0! font-mono text-[0.8rem] leading-snug break-normal! whitespace-pre!;
  }

  .prose-custom :global(.code-line) {
    @apply block! w-full! pr-3.5! pl-2!;
  }

  .prose-custom :global(.code-line-highlighted) {
    background-color: color-mix(
      in srgb,
      var(--code-theme-fg, currentColor) 12%,
      var(--code-theme-bg, transparent)
    ) !important;
  }

  .prose-custom
    :global(.code-block-container[data-code-theme] .code-line-highlighted),
  .prose-custom
    :global(
      .code-block-container[data-code-theme] .code-line-number-highlighted
    ) {
    background-color: color-mix(
      in srgb,
      var(--code-theme-fg) 12%,
      var(--code-theme-bg)
    ) !important;
  }

  .prose-custom
    :global(
      .code-block-container[data-code-theme] .code-line-number-highlighted
    ) {
    color: var(--code-theme-fg) !important;
  }

  .prose-custom
    :global(.code-block-container[data-code-theme] .code-line-number) {
    color: var(--code-theme-muted);
  }

  .prose-custom :global(pre.code-wrap),
  .prose-custom :global(pre[data-wrap='true']) {
    @apply overflow-x-hidden! wrap-anywhere! [word-break:break-word]! whitespace-pre-wrap!;
  }

  .prose-custom :global(pre.code-wrap code),
  .prose-custom :global(pre[data-wrap='true'] code) {
    @apply box-border! block! w-full! max-w-full! overflow-x-hidden! wrap-anywhere [word-break:break-word]! whitespace-pre-wrap!;
  }

  .prose-custom :global(pre.code-wrap .code-line),
  .prose-custom :global(pre[data-wrap='true'] .code-line) {
    @apply box-border! w-full! max-w-full! pl-[calc(0.5rem+4ch)]! indent-[-4ch] wrap-anywhere! [word-break:break-word]! whitespace-pre-wrap!;
  }

  .prose-custom :global(a) {
    @apply text-security no-underline hover:underline;
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
    @apply inline-block! size-[0.85em]! align-middle! leading-none! text-inherit! no-underline!;
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
    @apply my-6 w-full max-w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-sm border border-border-subtle text-left text-xs shadow-2xs;
  }

  .prose-custom :global(thead) {
    @apply border-b border-border-subtle bg-surface-hover/80 font-semibold tracking-wider text-text-primary uppercase;
  }

  .prose-custom :global(th) {
    @apply px-2.5 py-2 text-center font-semibold wrap-break-word [word-break:break-word] text-text-primary;
  }

  .prose-custom :global(tbody tr) {
    @apply transition-colors hover:bg-surface-hover/30;
  }

  .prose-custom :global(td) {
    @apply border-r border-border-subtle/40 px-2.5 py-1.5 text-left leading-relaxed wrap-break-word [word-break:break-word] text-text-secondary last:border-r-0;
  }

  .prose-custom :global(td code),
  .prose-custom :global(th code) {
    @apply wrap-anywhere [word-break:break-word] whitespace-normal;
  }

  .prose-custom :global(td[align='right']) {
    @apply text-right;
  }

  .prose-custom :global(td[align='center']) {
    @apply text-center;
  }

  .prose-custom :global(hr) {
    @apply my-8 h-px border-0 bg-border-subtle;
  }

  .prose-custom :global(blockquote:not(.markdown-alert)) {
    @apply my-6 rounded-sm border border-border-default/40 bg-surface-hover/30 p-4 text-sm leading-relaxed text-text-secondary;
  }

  .prose-custom :global(blockquote:not(.markdown-alert) p) {
    @apply my-1 text-text-secondary;
  }

  .prose-custom :global(ul) {
    @apply my-2 flex list-none flex-col gap-1 pl-0!;
  }

  .prose-custom :global(ol) {
    @apply my-2 list-decimal space-y-1 pl-6!;
  }

  .prose-custom :global(ul ul),
  .prose-custom :global(ol ul),
  .prose-custom :global(.ul-content > ul),
  .prose-custom :global(.task-content > ul) {
    @apply my-1 pl-0!;
  }

  .prose-custom :global(ul ol),
  .prose-custom :global(ol ol),
  .prose-custom :global(.ul-content > ol),
  .prose-custom :global(.task-content > ol) {
    @apply my-1 pl-6!;
  }

  .prose-custom :global(li.ul-list-item),
  .prose-custom :global(li.task-list-item) {
    @apply my-0.5 flex list-none items-start gap-2 pl-0!;
  }

  .prose-custom :global(li.ol-list-item) {
    @apply my-0.5 pl-0.5!;
  }

  .prose-custom :global(li p),
  .prose-custom :global(li > p) {
    margin: 0 !important;
    display: inline !important;
  }

  .prose-custom :global(input[type='checkbox']) {
    @apply inline-grid size-4.5! shrink-0 cursor-pointer appearance-none! place-content-center rounded border border-border-subtle bg-surface-base align-middle transition-colors duration-150;
  }

  .prose-custom :global(input[type='checkbox']:checked) {
    @apply border-copilot! bg-copilot!;
  }

  .prose-custom :global(input[type='checkbox']:checked::before) {
    content: '';
    @apply size-2.5 bg-white [clip-path:polygon(14%_44%,0_65%,50%_100%,100%_16%,80%_0%,43%_62%)];
  }

  .prose-custom :global(.markdown-alert) {
    @apply my-6 rounded-sm border p-4 text-xs transition-colors duration-200 sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-title) {
    @apply mb-1.5 flex items-center gap-2 font-sans-title text-xs leading-none font-semibold select-none sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-title svg) {
    @apply size-4 shrink-0 translate-y-[-6%];
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
    @apply border-security/40 bg-security-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-note .markdown-alert-title) {
    @apply text-security;
  }

  .prose-custom :global(.markdown-alert-tip) {
    @apply border-success/40 bg-success-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-tip .markdown-alert-title) {
    @apply text-success;
  }

  .prose-custom :global(.markdown-alert-important) {
    @apply border-copilot/40 bg-copilot-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-important .markdown-alert-title) {
    @apply text-copilot;
  }

  .prose-custom :global(.markdown-alert-warning) {
    @apply border-warning/40 bg-warning-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-warning .markdown-alert-title) {
    @apply text-warning-strong;
  }

  .prose-custom :global(.markdown-alert-caution) {
    @apply border-danger/40 bg-danger-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-caution .markdown-alert-title) {
    @apply text-danger;
  }

  .prose-custom :global(mark) {
    @apply rounded-sm bg-security-subtle px-1 py-0.5 font-normal text-security;
  }

  .prose-custom :global(kbd) {
    @apply inline-block rounded bg-code-inline-bg px-1.5 py-0.5 font-mono text-[0.875em] leading-normal font-normal text-inherit;
  }

  .prose-custom :global(sub) {
    @apply align-sub text-[0.75em] leading-none;
  }

  .prose-custom :global(sup) {
    @apply align-super text-[0.75em] leading-none;
  }

  .prose-custom :global(.markdown-steps-container) {
    --step-line-w: 1px;
    --step-badge-size: 1.5rem;
    @apply relative my-6 ml-0 space-y-0 select-text;
    counter-reset: step-counter;
  }

  .prose-custom
    :global(
      .markdown-steps-container > :not(.markdown-steps-list):not(.markdown-step)
    ) {
    @apply pl-9;
  }

  .prose-custom :global(.markdown-step) {
    counter-increment: step-counter;
    @apply relative pb-6 pl-9 text-text-secondary;
  }

  .prose-custom :global(.markdown-step:last-child) {
    @apply pb-0;
  }

  .prose-custom :global(.markdown-step::before) {
    content: counter(step-counter);
    position: absolute;
    top: 0.125rem;
    left: 0;
    width: var(--step-badge-size);
    height: var(--step-badge-size);
    line-height: var(--step-badge-size);
    background-color: color-mix(
      in srgb,
      var(--color-text-primary) 8%,
      var(--color-surface-base)
    );
    @apply z-10 flex items-center justify-center rounded border border-border-subtle/70 text-center font-mono text-xs font-medium text-text-primary tabular-nums select-none;
  }

  .prose-custom :global(.markdown-step::after) {
    content: '';
    position: absolute;
    top: calc(var(--step-badge-size) / 2 + 0.125rem);
    left: calc(var(--step-badge-size) / 2 - 0.5px);
    width: var(--step-line-w);
    bottom: calc(-1 * var(--step-badge-size) / 2 - 0.125rem);
    @apply pointer-events-none bg-border-subtle;
  }

  .prose-custom :global(.markdown-step:last-child::after) {
    display: none;
  }

  .prose-custom :global(.markdown-step > :is(h2, h3, h4)) {
    @apply relative mt-0! mb-2 flex items-center font-bold text-text-primary;
  }

  .prose-custom :global(.markdown-steps-list) {
    @apply my-0! list-none! space-y-0! pl-0!;
  }

  .prose-custom :global(.markdown-steps-list > li.markdown-step) {
    @apply relative my-0! list-none! pb-6 pl-9 text-text-secondary;
  }

  .prose-custom :global(.markdown-steps-list > li.markdown-step:last-child) {
    @apply pb-0!;
  }

  .prose-custom
    :global(.markdown-steps-list > li.markdown-step:last-child::after) {
    display: none;
  }

  .prose-custom :global(.markdown-tab-group) {
    @apply my-6;
  }

  .prose-custom :global(.markdown-tab-group-header) {
    @apply relative flex min-h-8 items-end border-b border-border-subtle select-none;
  }

  .prose-custom :global(.markdown-tab-group-nav) {
    @apply m-0 flex min-w-0 flex-1 scrollbar-none items-end gap-1.5 overflow-x-auto p-0 [-ms-overflow-style:none];
  }

  .prose-custom :global(.markdown-tab-group-body) {
    @apply pt-2;
  }

  .prose-custom
    :global(.markdown-tab-group-body > .markdown-tab-panel > :first-child) {
    @apply mt-2!;
  }

  .prose-custom :global(.markdown-tab-group .markdown-tab-panel) {
    @apply p-0;
  }

  .prose-custom :global(.markdown-tabs-container) {
    @apply my-6 rounded-sm border border-border-subtle bg-code-chrome shadow-2xs;
  }

  .prose-custom :global(.markdown-tabs-header) {
    @apply relative flex min-h-8 items-end justify-between rounded-t-sm border-b border-border-subtle bg-code-chrome px-3 pt-0 pb-0 select-none;
  }

  .prose-custom :global(.markdown-tabs-nav) {
    @apply m-0 flex min-w-0 flex-1 scrollbar-none items-end gap-1.5 overflow-x-auto p-0 [-ms-overflow-style:none];
  }

  .prose-custom :global(.markdown-tabs-actions) {
    @apply ml-2 flex shrink-0 items-center gap-1 self-center pb-0.5;
  }

  .prose-custom :global(.markdown-tab-button) {
    @apply relative -mb-px inline-flex shrink-0 cursor-pointer items-center justify-center border-b-[2.5px] px-3 py-1.5 text-xs font-medium transition-all select-none;
  }

  .prose-custom :global(.markdown-tab-button.active-tab) {
    @apply border-b-copilot font-bold text-copilot;
  }

  .prose-custom :global(.markdown-tab-button:not(.active-tab)) {
    @apply border-b-transparent text-text-muted hover:text-text-primary;
  }

  .prose-custom :global(.markdown-tabs-body) {
    @apply rounded-b-sm;
  }

  .prose-custom :global(.markdown-tabs-container .markdown-tab-panel) {
    @apply rounded-b-sm p-4;
  }

  .prose-custom
    :global(
      .markdown-tabs-container .markdown-tab-panel:has(> .code-block-container)
    ),
  .prose-custom
    :global(.markdown-tabs-container .markdown-tab-panel:has(> .code-body)),
  .prose-custom
    :global(.markdown-tabs-container .markdown-tab-panel:has(> pre)),
  .prose-custom
    :global(
      .markdown-tabs-container .markdown-tab-panel:has(.code-block-container)
    ) {
    @apply rounded-b-sm p-0!;
  }

  .prose-custom :global(.markdown-tabs-container .code-block-container) {
    @apply my-0! rounded-b-sm! border-0!;
  }

  .prose-custom :global(.markdown-tabs-container .code-header-bar) {
    @apply hidden!;
  }

  .prose-custom :global(.markdown-tabs-container .code-body) {
    @apply rounded-b-sm! border-0!;
  }

  .prose-custom :global(.markdown-tabs-container .code-scrollbar-wrapper) {
    @apply rounded-b-sm! border-0!;
  }

  .prose-custom :global(.markdown-tabs-container pre) {
    @apply my-0! rounded-b-sm! border-0!;
  }

  .prose-custom :global(details.markdown-details),
  .prose-custom :global(details) {
    @apply my-4 overflow-hidden rounded-sm glass-card border border-border-subtle text-text-primary shadow-md backdrop-blur-md;
    border: 1px solid var(--color-border-subtle);
  }

  :global(.dark) .prose-custom :global(details.markdown-details),
  :global(.dark) .prose-custom :global(details) {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .prose-custom :global(details > summary),
  .prose-custom :global(.markdown-details-summary) {
    @apply flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 border-b border-transparent px-3.5 py-1.5 font-sans-title text-sm font-medium text-text-primary transition-colors select-none hover:bg-surface-hover/50 [&::-webkit-details-marker]:hidden;
  }

  .prose-custom :global(details[open] > summary),
  .prose-custom :global(details[open] .markdown-details-summary) {
    border-bottom: 1px solid var(--color-border-subtle) !important;
    @apply bg-surface-hover/30;
  }

  :global(.dark) .prose-custom :global(details[open] > summary),
  :global(.dark)
    .prose-custom
    :global(details[open] .markdown-details-summary) {
    border-bottom-color: rgba(255, 255, 255, 0.1) !important;
  }

  .prose-custom :global(.markdown-details-title) {
    @apply inline-flex translate-y-px items-center text-sm leading-none font-medium text-text-primary;
  }

  .prose-custom :global(.markdown-details-icon) {
    @apply inline-flex shrink-0 items-center justify-center text-text-muted;
  }

  .prose-custom :global(.markdown-details-body) {
    @apply px-3.5 py-3 text-sm leading-relaxed font-normal text-text-secondary;
  }

  .prose-custom :global(details[open] .markdown-details-body) {
    animation: details-expand 300ms cubic-bezier(0.25, 1, 0.5, 1) both;
  }

  .prose-custom :global(.markdown-details-body > :first-child) {
    @apply mt-0!;
  }

  .prose-custom :global(.markdown-details-body > :last-child) {
    @apply mb-0!;
  }

  .prose-custom :global(.markdown-details-body p),
  .prose-custom :global(details p) {
    @apply my-2 text-sm leading-relaxed text-text-secondary;
  }

  .prose-custom :global(.markdown-details-body ul),
  .prose-custom :global(.markdown-details-body ol),
  .prose-custom :global(details ul),
  .prose-custom :global(details ol) {
    @apply my-2 pl-5 text-sm leading-relaxed;
  }

  .prose-custom :global(.markdown-details-body li),
  .prose-custom :global(details li) {
    @apply text-sm leading-relaxed;
  }

  .prose-custom :global(.footnotes) {
    @apply mt-10 border-t border-border-subtle pt-4 text-xs leading-relaxed text-text-secondary sm:text-sm;
  }

  .prose-custom :global(.footnotes ol) {
    @apply my-2 list-decimal space-y-1.5 pl-6;
  }

  .prose-custom :global(.footnotes li p) {
    @apply my-0 inline;
  }

  .prose-custom :global([data-footnote-ref]) {
    @apply text-[0.9em] font-normal text-security no-underline hover:underline;
  }

  .prose-custom :global(.footnotes li) {
    display: list-item;
  }

  .prose-custom :global(.footnotes li::marker) {
    color: var(--color-text-secondary);
  }

  .prose-custom :global([data-footnote-backref]) {
    @apply inline-flex items-center text-security no-underline hover:underline;
    font-size: 0;
    margin-left: 0.25rem;
    vertical-align: baseline;
  }

  .prose-custom :global([data-footnote-backref] + [data-footnote-backref]) {
    margin-left: 0.15rem;
  }

  .prose-custom :global([data-footnote-backref]::before) {
    content: '';
    display: inline-block;
    width: 0.75em;
    height: 0.75em;
    vertical-align: middle;
    background-color: currentColor;
    -webkit-mask: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>')
      center / contain no-repeat;
    mask: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>')
      center / contain no-repeat;
    font-size: 0.75rem;
  }

  .prose-custom :global([data-footnote-backref] sup) {
    @apply font-mono;
    font-size: 0.55rem !important;
    line-height: 1 !important;
    font-weight: 500;
    vertical-align: super;
    margin-left: 0.05rem;
    color: currentColor;
    display: inline-block;
  }

  .prose-custom :global(.footnotes li:target a) {
    @apply underline;
  }

  .prose-custom > :global(*:first-child) {
    @apply mt-0!;
  }
</style>
