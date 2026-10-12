<script lang="ts">
    import { onMount, tick } from 'svelte';
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
        Ellipsis,
        Highlighter,
        Keyboard,
        Subscript,
        Superscript,
        Image as ImageIcon,
        Video,
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
    import FieldMessage from './FieldMessage.svelte';
    import {
        renderMarkdown,
        injectHeadingIds,
        MATH_BLOCK_RE,
        MATH_INLINE_RE
    } from '#lib/markdown.ts';
    import { supabase } from '#lib/supabase.ts';
    import { splitHighlightedHtmlLines } from '#lib/utils/codeBlocks.ts';
    import { enhanceMarkdownContent } from '#lib/utils/markdownEnhancer.ts';
    import { enhanceHeadingAnchors } from '#lib/utils/headingAnchors.ts';
    import { contentFontStore } from '#lib/stores/contentFontStore.svelte.ts';
    import 'katex/dist/katex.min.css';
    import hljs from 'highlight.js';
    import { applyCodeThemeVariables, ensureHljsThemeStylesheet } from '#lib/utils/codeBlocks.ts';
    import { cn } from '#lib/utils/cn.ts';
    import IconButton from './IconButton.svelte';
    import Dropdown from './Dropdown.svelte';
    import Tooltip from './Tooltip.svelte';
    import { themeStore } from '#lib/stores/themeStore.svelte.ts';

    interface Props {
        value?: string;
        autosaveKey?: string;
        placeholder?: string;
        minHeight?: string;
        stickyTopClass?: string;
        class?: string;
        onblur?: () => void;
        onImageUpload?: (file: File) => Promise<string | null>;
        onVideoUpload?: (file: File) => Promise<string | null>;
    }

    let {
        value = $bindable(''),
        autosaveKey = '',
        placeholder = 'Write your markdown content here...',
        minHeight = '400px',
        stickyTopClass = 'top-0',
        class: className = '',
        onImageUpload,
        onVideoUpload,
        onblur
    }: Props = $props();

    let activeTab = $state<'editor' | 'preview'>('editor');
    let previewHtml = $state('');
    let previewError = $state('');
    let previewContainerEl: HTMLDivElement | undefined = $state();
    let lineWrapMode = $state<'soft' | 'none'>('soft');
    let indentMode = $state<'spaces' | 'tabs'>('spaces');
    let indentSize = $state(4);

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
                    preferences.indentMode === 'tabs' || preferences.indentMode === 'spaces' ?
                        (preferences.indentMode as EditorPreferences['indentMode'])
                    :   defaults.indentMode,
                indentSize:
                    (
                        typeof preferences.indentSize === 'number'
                        && INDENT_SIZES.includes(preferences.indentSize as IndentSize)
                    ) ?
                        (preferences.indentSize as IndentSize)
                    :   defaults.indentSize,
                lineWrapMode:
                    preferences.lineWrapMode === 'none' || preferences.lineWrapMode === 'soft' ?
                        (preferences.lineWrapMode as EditorPreferences['lineWrapMode'])
                    :   defaults.lineWrapMode,
                showLineNumbers:
                    typeof preferences.showLineNumbers === 'boolean' ?
                        preferences.showLineNumbers
                    :   defaults.showLineNumbers,
                autosaveEnabled:
                    typeof preferences.autosaveEnabled === 'boolean' ?
                        preferences.autosaveEnabled
                    :   defaults.autosaveEnabled
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
    let videoFileInput = $state<HTMLInputElement | null>(null);

    let autoSaveTimer: ReturnType<typeof setTimeout>;

    const lineCount = $derived(
        (value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').length
    );
    const gutterWidth = $derived(
        showLineNumbers ? `calc(${Math.max(2, String(lineCount).length)}ch + 1.25rem)` : '0px'
    );
    const lineEnding = $derived((value || '').includes('\r\n') ? 'CRLF' : 'LF');
    const autosaveState = $derived(autosaveEnabled ? 'on' : 'off');
    const editorTheme = $derived<'light' | 'dark'>(themeStore.isDark ? 'dark' : 'light');

    const highlightedMarkdown = $derived.by(() => {
        try {
            const code = value || '';
            const mathPlaceholders: { id: string; html: string }[] = [];
            let mathCounter = 0;

            const escapeFormula = (formula: string) =>
                formula.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            let processed = code.replace(MATH_BLOCK_RE, block => {
                const id = `XQZMATHBLOCK${mathCounter++}XQZ`;
                mathPlaceholders.push({
                    id,
                    html: `<span class="hljs-formula">${escapeFormula(block)}</span>`
                });
                return id;
            });

            processed = processed.replace(MATH_INLINE_RE, (_, formula) => {
                const id = `XQZMATHINLINE${mathCounter++}XQZ`;
                mathPlaceholders.push({
                    id,
                    html: `<span class="hljs-formula">$$${escapeFormula(formula)}$$</span>`
                });
                return id;
            });

            let res = hljs.highlight(processed, { language: 'markdown' }).value;
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
            const data = { content: value, timestamp: Date.now() };
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
        let active = true;
        if (value !== undefined) {
            renderMarkdown(value, supabase)
                .then(html => {
                    if (active) {
                        previewHtml = injectHeadingIds(html);
                        previewError = '';
                    }
                })
                .catch(error => {
                    if (active) {
                        previewHtml = '';
                        previewError =
                            error instanceof Error ?
                                error.message
                            :   'Preview could not be rendered.';
                    }
                });
        }
        return () => {
            active = false;
        };
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
        if (activeTab === 'preview' && previewHtml && previewContainerEl) {
            tick().then(() => {
                if (!previewContainerEl) return;
                const blocks = previewContainerEl.querySelectorAll('pre code');
                blocks.forEach(block => {
                    hljs.highlightElement(block as HTMLElement);
                });
                enhanceMarkdownContent({
                    container: previewContainerEl,
                    isDark: editorTheme === 'dark',
                    onCodeCopy: () => {}
                });
                enhanceHeadingAnchors(previewContainerEl);
            });
        }
    });

    function updateCursorPosition() {
        if (!markdownTextareaElement) return;
        const textBeforeCursor = (value || '').substring(0, markdownTextareaElement.selectionStart);
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

        if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
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
                    target.selectionStart = target.selectionEnd = start + continuation!.length;
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
            markdownTextareaElement!.selectionEnd = start + prefix.length + selectedText.length;
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

    function handleVideoClick() {
        if (onVideoUpload) {
            videoFileInput?.click();
        } else {
            insertMarkdown('![Video](', ')');
        }
    }

    async function handleVideoFileSelected(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file || !onVideoUpload) return;
        try {
            const url = await onVideoUpload(file);
            if (url) insertMarkdown(`![Video](${url})\n`);
        } catch {
        } finally {
            input.value = '';
        }
    }
</script>

{#snippet statusContent()}
    <div class="flex min-w-0 items-center gap-3 overflow-x-auto">
        <span class="editor-theme-foreground shrink-0">Ln {currentLine}, Col {currentColumn}</span>
        <span class="flex shrink-0 items-center gap-1">
            <Indent class="hidden size-3 sm:inline-flex" />
            <span class="sm:hidden">{indentMode === 'tabs' ? 'T' : `S: ${indentSize}`}</span>
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
                        class="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
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
                    class="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:hidden">
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
                    class="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
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
        'editor-shell relative flex min-h-0 flex-col rounded-md border text-left shadow-xl',
        className
    )}>
    <span
        bind:this={themeProbeElement}
        class="editor-theme-probe hljs"
        aria-hidden="true"></span>
    <div class="editor-header sticky {stickyTopClass} z-30 flex flex-col rounded-t-md shadow-md">
        <div
            class="editor-chrome flex min-h-10 items-center rounded-t-md border-b px-2 py-1 shadow-2xs select-none sm:px-3">
            <div class="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <div
                    class="editor-tab-list flex h-8 min-w-0 items-center rounded-md border p-0.5"
                    role="tablist"
                    aria-label="Markdown editor views">
                    <button
                        type="button"
                        onclick={() => (activeTab = 'editor')}
                        role="tab"
                        aria-selected={activeTab === 'editor'}
                        class="editor-tab inline-flex h-7 cursor-pointer items-center rounded-sm px-3 font-mono text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none sm:px-4 {(
                            activeTab === 'editor'
                        ) ?
                            'bg-accent text-text-on-accent! shadow-xs'
                        :   'editor-tab-inactive'}">
                        Edit
                    </button>
                    <button
                        type="button"
                        onclick={() => (activeTab = 'preview')}
                        role="tab"
                        aria-selected={activeTab === 'preview'}
                        class="editor-tab inline-flex h-7 cursor-pointer items-center rounded-sm px-3 font-mono text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none sm:px-4 {(
                            activeTab === 'preview'
                        ) ?
                            'bg-accent text-text-on-accent! shadow-xs'
                        :   'editor-tab-inactive'}">
                        Preview
                    </button>
                </div>

                {#if activeTab === 'editor'}
                    <div class="ml-auto hidden items-center gap-1 select-none sm:flex">
                        <IconButton
                            ariaLabel="Indent mode: {indentMode === 'spaces' ? 'Spaces' : 'Tabs'}"
                            tooltip="Indent mode: {indentMode === 'spaces' ? 'Spaces' : 'Tabs'}"
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
                        <Dropdown
                            ariaLabel="Indent size"
                            options={INDENT_SIZES.map(size => ({
                                value: size,
                                label: `${size} spaces`
                            }))}
                            value={indentSize}
                            onChange={setIndentSize}>
                            {#snippet trigger({ isOpen, toggle })}
                                <IconButton
                                    ariaLabel="Indent size: {indentSize} spaces"
                                    tooltip="Indent size: {indentSize}"
                                    size="sm"
                                    class="editor-control-button"
                                    aria-haspopup="listbox"
                                    aria-expanded={isOpen}
                                    onclick={toggle}>
                                    <RulerDimensionLine class="size-3.5" />
                                </IconButton>
                            {/snippet}
                        </Dropdown>
                        <IconButton
                            ariaLabel="Line wrapping: {lineWrapMode === 'soft' ? 'Wrap' : 'Nowrap'}"
                            tooltip="Line wrapping: {lineWrapMode === 'soft' ? 'Wrap' : 'Nowrap'}"
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
                        <Dropdown
                            ariaLabel="Editor settings"
                            placement="bottom-end">
                            {#snippet trigger({ isOpen, toggle })}
                                <IconButton
                                    ariaLabel="Editor settings"
                                    tooltip="Editor settings"
                                    size="sm"
                                    class="editor-control-button"
                                    aria-haspopup="dialog"
                                    aria-expanded={isOpen}
                                    onclick={toggle}>
                                    <Bolt class="size-3.5" />
                                </IconButton>
                            {/snippet}
                            <div class="flex max-w-[calc(100vw-1rem)] min-w-56 flex-col text-xs">
                                <div class="flex items-center justify-between gap-3 px-3 py-1.5">
                                    <span class="text-text-muted">Indent mode</span>
                                    <IconButton
                                        ariaLabel="Indent mode: {indentMode === 'spaces' ? 'Spaces'
                                        :   'Tabs'}"
                                        size="xs"
                                        class="text-text-secondary hover:text-accent"
                                        onclick={() =>
                                            setIndentMode(
                                                indentMode === 'spaces' ? 'tabs' : 'spaces'
                                            )}>
                                        {#if indentMode === 'spaces'}
                                            <Space class="size-3.5" />
                                        {:else}
                                            <ArrowRightToLine class="size-3.5" />
                                        {/if}
                                    </IconButton>
                                </div>
                                <div class="flex items-center justify-between gap-3 px-3 py-1.5">
                                    <span class="text-text-muted">Indent size</span>
                                    <div class="flex items-center gap-1">
                                        {#each INDENT_SIZES as size (size)}
                                            <button
                                                type="button"
                                                aria-pressed={indentSize === size}
                                                onclick={() => setIndentSize(size)}
                                                class={cn(
                                                    'inline-flex cursor-pointer items-center justify-center rounded-md px-2.5 py-1 transition-colors hover:bg-surface-hover hover:text-accent',
                                                    indentSize === size ?
                                                        'bg-accent/10 font-semibold text-accent'
                                                    :   'text-text-secondary'
                                                )}>
                                                {size}
                                            </button>
                                        {/each}
                                    </div>
                                </div>
                                <div class="flex items-center justify-between gap-3 px-3 py-1.5">
                                    <span class="text-text-muted">Line wrapping</span>
                                    <IconButton
                                        ariaLabel="Line wrapping: {lineWrapMode === 'soft' ? 'Wrap'
                                        :   'Nowrap'}"
                                        size="xs"
                                        class="text-text-secondary hover:text-accent"
                                        onclick={() =>
                                            setLineWrapMode(
                                                lineWrapMode === 'soft' ? 'none' : 'soft'
                                            )}>
                                        {#if lineWrapMode === 'soft'}
                                            <TextWrap class="size-3.5" />
                                        {:else}
                                            <Summary class="size-3.5" />
                                        {/if}
                                    </IconButton>
                                </div>
                                <div class="flex items-center justify-between gap-3 px-3 py-1.5">
                                    <span class="text-text-muted">Line numbers</span>
                                    <IconButton
                                        ariaLabel="Line numbers: {showLineNumbers ? 'on' : 'off'}"
                                        size="xs"
                                        class="text-text-secondary hover:text-accent"
                                        onclick={() => setLineNumbers(!showLineNumbers)}>
                                        {#if showLineNumbers}
                                            <ListOrdered class="size-3.5" />
                                        {:else}
                                            <TextAlignJustify class="size-3.5" />
                                        {/if}
                                    </IconButton>
                                </div>
                            </div>
                        </Dropdown>
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
                    {#each [{ action: () => insertMarkdown('# '), icon: Heading1, label: 'H1 heading' }, { action: () => insertMarkdown('## '), icon: Heading2, label: 'H2 heading' }, { action: () => insertMarkdown('### '), icon: Heading3, label: 'H3 heading' }] as const as item (item.label)}
                        <button
                            type="button"
                            onclick={item.action}
                            aria-label={item.label}
                            class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
                            <item.icon class="size-4" />
                        </button>
                    {/each}

                    <Dropdown
                        ariaLabel="More headings"
                        actions={[
                            {
                                label: 'Heading 4',
                                icon: Heading4,
                                onSelect: () => insertMarkdown('#### ')
                            },
                            {
                                label: 'Heading 5',
                                icon: Heading5,
                                onSelect: () => insertMarkdown('##### ')
                            },
                            {
                                label: 'Heading 6',
                                icon: Heading6,
                                onSelect: () => insertMarkdown('###### ')
                            }
                        ]}>
                        {#snippet trigger({ isOpen, toggle })}
                            <button
                                type="button"
                                onclick={toggle}
                                aria-label="More headings (H4-H6)"
                                aria-haspopup="menu"
                                aria-expanded={isOpen}
                                class="flex h-7 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-md px-1 transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
                                <Heading class="size-4" />
                                <ChevronDown
                                    class="size-3 transition-transform duration-200 {isOpen ?
                                        'rotate-180'
                                    :   ''}" />
                            </button>
                        {/snippet}
                    </Dropdown>

                    <div
                        class="mx-1 h-4 w-px shrink-0 bg-border-subtle"
                        aria-hidden="true">
                    </div>

                    {#each [{ action: () => insertMarkdown('**', '**'), icon: Bold, label: 'Bold' }, { action: () => insertMarkdown('*', '*'), icon: Italic, label: 'Italic' }, { action: () => insertMarkdown('<u>', '</u>'), icon: Underline, label: 'Underline' }, { action: () => insertMarkdown('~~', '~~'), icon: Strikethrough, label: 'Strikethrough' }, { action: () => insertMarkdown('`', '`'), icon: Code, label: 'Inline code' }] as const as item (item.label)}
                        <button
                            type="button"
                            onclick={item.action}
                            aria-label={item.label}
                            class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
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
                        class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
                        <ImageIcon class="size-4" />
                    </button>
                    <input
                        type="file"
                        bind:this={imageFileInput}
                        accept="image/png, image/webp, image/jpeg, image/jpg"
                        onchange={handleFileSelected}
                        class="hidden"
                        aria-label="Upload image file" />
                    <button
                        type="button"
                        onclick={handleVideoClick}
                        aria-label="Insert video"
                        class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
                        <Video class="size-4" />
                    </button>
                    <input
                        type="file"
                        bind:this={videoFileInput}
                        accept="video/mp4, video/webm"
                        onchange={handleVideoFileSelected}
                        class="hidden"
                        aria-label="Upload video file" />
                    {#each [{ action: () => insertMarkdown('[', '](url)'), icon: LinkIcon, label: 'Insert link' }, { action: () => insertMarkdown('1. '), icon: ListOrdered, label: 'Numbered list' }, { action: () => insertMarkdown('- '), icon: List, label: 'Bulleted list' }, { action: () => insertMarkdown('- [ ] '), icon: ListTodo, label: 'Task list' }, { action: () => insertMarkdown('> '), icon: Quote, label: 'Blockquote' }] as const as item (item.label)}
                        <button
                            type="button"
                            onclick={item.action}
                            aria-label={item.label}
                            class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
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
                        class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
                        <SquareCode class="size-4" />
                    </button>

                    <div
                        class="mx-1 h-4 w-px shrink-0 bg-border-subtle"
                        aria-hidden="true">
                    </div>

                    <Dropdown
                        ariaLabel="More formatting options"
                        actions={[
                            {
                                onSelect: () => insertMarkdown('<kbd>', '</kbd>'),
                                icon: Keyboard,
                                label: 'Keyboard key'
                            },
                            {
                                onSelect: () => insertMarkdown('<mark>', '</mark>'),
                                icon: Highlighter,
                                label: 'Highlight'
                            },
                            {
                                onSelect: () => insertMarkdown('<sub>', '</sub>'),
                                icon: Subscript,
                                label: 'Subscript'
                            },
                            {
                                onSelect: () => insertMarkdown('<sup>', '</sup>'),
                                icon: Superscript,
                                label: 'Superscript'
                            },
                            {
                                onSelect: () =>
                                    insertMarkdown(
                                        '| Header 1 | Header 2 |\n|----------|-----------|\n|  Cell 1  |  Cell 2  |\n'
                                    ),
                                icon: TableIcon,
                                label: 'Add table'
                            },
                            {
                                onSelect: () =>
                                    insertMarkdown(':::details summary="Details"\n', '\n:::\n'),
                                icon: ChevronsUpDown,
                                label: 'Collapsible details'
                            },
                            {
                                onSelect: () => insertMarkdown('\n---\n'),
                                icon: Minus,
                                label: 'Horizontal rule'
                            }
                        ]}>
                        {#snippet trigger({ isOpen, toggle })}
                            <button
                                type="button"
                                onclick={toggle}
                                aria-label="More formatting options"
                                aria-haspopup="menu"
                                aria-expanded={isOpen}
                                class="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-hover/30 hover:text-text-primary">
                                <Ellipsis class="size-4" />
                            </button>
                        {/snippet}
                    </Dropdown>
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
                            {#each { length: lineCount } as _, i (i)}
                                <div
                                    class={cn(
                                        'editor-gutter-num box-border flex items-start justify-center px-1 text-center font-mono leading-6 tabular-nums select-none',
                                        currentLine === i + 1 ?
                                            'editor-line-number-active font-medium'
                                        :   'editor-gutter-muted'
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
                            class="editor-pre pointer-events-none m-0! box-border! min-h-full! w-full! scrollbar-none overflow-x-auto! overflow-y-hidden! border-0! bg-transparent pt-0! pr-5! pb-5! pl-2! break-normal! wrap-normal! [word-break:normal]! whitespace-pre! select-none [-ms-overflow-style:none] [grid-area:editor] [&::-webkit-scrollbar]:hidden"><code
                                class="hljs language-markdown m-0! block! w-max! min-w-full! overflow-x-visible! p-0! wrap-normal! [word-break:normal]! whitespace-pre!"
                                data-code-theme={editorTheme}
                                >{#each splitHighlightedHtmlLines(highlightedMarkdown) as lineHtml, i (i)}<div
                                        class={cn(
                                            'editor-code-line m-0! block! w-max! min-w-full! leading-6! wrap-normal! [word-break:normal]! whitespace-pre!',
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
                            {onblur}
                            onkeydown={handleTextareaKeyDown}
                            class="editor-textarea m-0! box-border! h-full! min-h-full! w-full! resize-none! overflow-x-auto! overflow-y-hidden! border-0! bg-transparent! pt-0! pr-5! pb-5! pl-2! break-normal! wrap-normal! [word-break:normal]! whitespace-pre! text-transparent caret-text-primary outline-hidden! [grid-area:editor] placeholder:text-text-muted/60 focus:border-transparent! focus:shadow-none! focus:ring-0 focus:outline-none focus-visible:border-transparent! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:outline-hidden!"
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
                    <div class="relative grid min-h-full w-full [grid-template-areas:'editor']">
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
                                                    :   'editor-gutter-muted'
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
                            {onblur}
                            onkeydown={handleTextareaKeyDown}
                            class="editor-textarea m-0! box-border! h-full! min-h-full! w-full! resize-none! overflow-hidden! border-0! bg-transparent! pt-0! pr-5! pb-5! break-normal! wrap-break-word! whitespace-pre-wrap! text-transparent caret-text-primary outline-hidden! [grid-area:editor] placeholder:text-text-muted/60 focus:border-transparent! focus:shadow-none! focus:ring-0 focus:outline-none focus-visible:border-transparent! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:outline-hidden!"
                            style:padding-left={showLineNumbers ?
                                'calc(var(--editor-gutter-width) + 0.5rem)'
                            :   '0.5rem'}></textarea>
                    </div>
                </div>
            {/if}
        {:else}
            <div
                bind:this={previewContainerEl}
                class="prose-custom font-content-{contentFontStore.current} editor-surface w-full p-6"
                style:min-height={minHeight || undefined}>
                {#if previewError}<FieldMessage
                        variant="error"
                        message={previewError} />{/if}
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
            class="editor-chrome editor-status-bar sticky bottom-0 z-20 flex min-h-8 items-center justify-between gap-3 rounded-b-md border-t px-3 font-mono text-xxs select-none sm:px-4">
            {@render statusContent()}
        </div>
    {/if}
</div>

<style>
    @reference "../global.css";

    .editor-shell {
        background-color: var(--code-theme-bg);
        border-color: var(--code-theme-border);
        color: var(--code-theme-fg);
    }

    .editor-header {
        background-color: color-mix(in srgb, var(--code-theme-bg) 96%, var(--code-theme-fg));
    }

    .editor-chrome {
        background-color: color-mix(in srgb, var(--code-theme-bg) 96%, var(--code-theme-fg));
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
        background-color: color-mix(in srgb, var(--code-theme-bg) 88%, var(--code-theme-fg));
        border-color: var(--code-theme-border);
        color: var(--code-theme-muted);
    }

    :global(.editor-control-button:hover),
    :global(.editor-control-button[aria-expanded='true']) {
        background-color: color-mix(in srgb, var(--code-theme-fg) 14%, var(--code-theme-bg));
        border-color: var(--code-theme-border);
        color: var(--code-theme-fg);
    }

    :global(.editor-control-button:focus-visible) {
        border-color: var(--code-theme-border);
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
        background-color: color-mix(in srgb, var(--code-theme-fg) 8%, var(--code-theme-bg));
    }

    .editor-code-line-active .editor-gutter-num {
        background-color: color-mix(in srgb, var(--code-theme-fg) 8%, var(--code-theme-bg));
    }

    .prose-custom > :global(*:first-child) {
        @apply mt-0!;
    }
</style>
