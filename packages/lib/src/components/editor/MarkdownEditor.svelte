<script lang="ts">
    import { onMount } from 'svelte';
    import type { Attachment } from 'svelte/attachments';
    import { renderMarkdown, injectHeadingIds, prefixHashLinks } from '@fkp/mdrs';
    import 'katex/dist/katex.min.css';
    import './editor.css';
    import { applyCodeThemeVariables, ensureHljsThemeStylesheet } from '#lib/utils/codeBlocks.ts';
    import { cn } from '#lib/utils/cn.ts';
    import { themeStore } from '#lib/stores/themeStore.svelte.ts';
    import EditorViewBar from './EditorViewBar.svelte';
    import EditorToolbar from './EditorToolbar.svelte';
    import EditorCodeArea from './EditorCodeArea.svelte';
    import EditorPreview from './EditorPreview.svelte';
    import EditorStatusBar from './EditorStatusBar.svelte';
    import { EditorPreferences } from './preferences.svelte';

    interface Props {
        value?: string;
        autosaveKey?: string;
        placeholder?: string;
        minHeight?: string;
        stickyTopClass?: string;
        class?: string;
        render?: (markdown: string) => Promise<string>;
        onblur?: () => void;
        onImageUpload?: (file: File) => Promise<string | null>;
        onVideoUpload?: (file: File) => Promise<string | null>;
        onImport?: (file: File) => void;
        importAccept?: string;
    }

    let {
        value = $bindable(''),
        autosaveKey = '',
        placeholder = 'Write your markdown content here...',
        minHeight = '400px',
        stickyTopClass = 'top-0',
        class: className = '',
        render = markdown => renderMarkdown(markdown),
        onblur,
        onImageUpload,
        onVideoUpload,
        onImport,
        importAccept
    }: Props = $props();

    const preferences = new EditorPreferences();
    onMount(() => preferences.load());

    let activeTab = $state<'editor' | 'preview'>('editor');
    let previewHtml = $state('');
    let previewError = $state('');
    let cursor = $state({ line: 1, column: 1 });
    let codeArea = $state<ReturnType<typeof EditorCodeArea> | null>(null);

    const editorTheme = $derived<'light' | 'dark'>(themeStore.isDark ? 'dark' : 'light');
    const lineEnding = $derived<'LF' | 'CRLF'>((value || '').includes('\r\n') ? 'CRLF' : 'LF');

    $effect(() => {
        if (!preferences.ready || !preferences.autosaveEnabled || !autosaveKey || !value) return;
        const content = value;
        const timer = setTimeout(() => {
            localStorage.setItem(autosaveKey, JSON.stringify({ content, timestamp: Date.now() }));
        }, 500);
        return () => clearTimeout(timer);
    });

    $effect(() => {
        if (activeTab !== 'preview') return;
        let active = true;
        render(value || '')
            .then(html => {
                if (!active) return;
                previewHtml = prefixHashLinks(injectHeadingIds(html));
                previewError = '';
            })
            .catch(error => {
                if (!active) return;
                previewHtml = '';
                previewError =
                    error instanceof Error ? error.message : 'Preview could not be rendered.';
            });
        return () => {
            active = false;
        };
    });

    const codeTheme: Attachment<HTMLSpanElement> = probe => {
        const shell = probe.parentElement;
        const theme = editorTheme;
        let cancelled = false;
        ensureHljsThemeStylesheet(theme).then(() => {
            if (!cancelled && shell) applyCodeThemeVariables(shell, probe);
        });
        return () => {
            cancelled = true;
        };
    };

    export function insertMarkdown(prefix: string, suffix = '') {
        codeArea?.insert(prefix, suffix);
    }
</script>

<div
    data-code-theme={editorTheme}
    style:--editor-min-height={minHeight}
    class={cn(
        'editor-shell relative flex min-h-0 flex-col rounded-md border text-left shadow-xl',
        className
    )}>
    <span
        {@attach codeTheme}
        class="editor-theme-probe hljs"
        aria-hidden="true"></span>
    <div class="editor-header sticky {stickyTopClass} z-30 flex flex-col rounded-t-md shadow-md">
        <EditorViewBar
            bind:activeTab
            {preferences}
            {importAccept}
            {onImport} />
        {#if activeTab === 'editor'}
            <EditorToolbar
                insert={insertMarkdown}
                {onImageUpload}
                {onVideoUpload} />
        {/if}
    </div>

    <div
        class="editor-surface flex-1 font-mono"
        style:min-height={minHeight || undefined}>
        {#if activeTab === 'editor'}
            <EditorCodeArea
                bind:this={codeArea}
                bind:value
                bind:cursor
                {preferences}
                theme={editorTheme}
                {placeholder}
                {minHeight}
                {onblur} />
        {:else}
            <EditorPreview
                html={previewHtml}
                error={previewError}
                {minHeight}
                isDark={editorTheme === 'dark'} />
        {/if}
    </div>

    {#if activeTab === 'editor'}
        <EditorStatusBar
            {preferences}
            line={cursor.line}
            column={cursor.column}
            {lineEnding}
            showAutosave={Boolean(autosaveKey)}
            onFocusEditor={() => codeArea?.focus()} />
    {/if}
</div>
