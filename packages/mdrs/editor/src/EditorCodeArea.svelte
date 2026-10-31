<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: MIT OR Apache-2.0
-->

<script lang="ts">
    import { tick } from 'svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { splitHighlightedHtmlLines } from '@mdrs/dom/codeBlocks.ts';
    import { highlightMarkdown } from './highlight';
    import type { EditorPreferences } from './preferences.svelte';
    import {
        continueBlock,
        cursorPosition,
        insertIndent,
        wrapSelection,
        type CursorPosition,
        type TextEdit
    } from './textEdits';

    interface Props {
        value?: string;
        preferences: EditorPreferences;
        theme: 'light' | 'dark';
        placeholder: string;
        minHeight: string;
        cursor?: CursorPosition;
        onblur?: () => void;
    }

    let {
        value = $bindable(''),
        preferences,
        theme,
        placeholder,
        minHeight,
        cursor = $bindable({ line: 1, column: 1 }),
        onblur
    }: Props = $props();

    let textarea = $state<HTMLTextAreaElement | null>(null);
    let pre = $state<HTMLPreElement | null>(null);

    const lineCount = $derived(
        (value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').length
    );
    const gutterWidth = $derived(
        preferences.showLineNumbers ?
            `calc(${Math.max(2, String(lineCount).length)}ch + 1.25rem)`
        :   '0px'
    );
    const highlightedLines = $derived(splitHighlightedHtmlLines(highlightMarkdown(value || '')));

    function syncScroll() {
        if (!textarea || !pre) return;
        pre.scrollTop = textarea.scrollTop;
        pre.scrollLeft = textarea.scrollLeft;
    }

    function updateCursor() {
        if (!textarea) return;
        cursor = cursorPosition(value || '', textarea.selectionStart);
    }

    function applyEdit(edit: TextEdit, focus = false) {
        value = edit.value;
        tick().then(() => {
            if (!textarea) return;
            if (focus) textarea.focus();
            textarea.selectionStart = edit.selectionStart;
            textarea.selectionEnd = edit.selectionEnd;
            syncScroll();
            updateCursor();
        });
    }

    export function insert(prefix: string, suffix = '') {
        if (!textarea) return;
        applyEdit(
            wrapSelection(
                value || '',
                textarea.selectionStart,
                textarea.selectionEnd,
                prefix,
                suffix
            ),
            true
        );
    }

    export function focus() {
        textarea?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
        const target = event.currentTarget as HTMLTextAreaElement;
        if (event.key === 'Tab') {
            event.preventDefault();
            applyEdit(
                insertIndent(
                    value || '',
                    target.selectionStart,
                    target.selectionEnd,
                    preferences.indent
                )
            );
            return;
        }
        if (
            event.key === 'Enter'
            && !event.shiftKey
            && !event.altKey
            && !event.ctrlKey
            && !event.metaKey
        ) {
            const edit = continueBlock(value || '', target.selectionStart, target.selectionEnd);
            if (!edit) return;
            event.preventDefault();
            applyEdit(edit);
        }
    }

    function handleInput() {
        syncScroll();
        updateCursor();
    }
</script>

{#if preferences.lineWrapMode === 'none'}
    <div
        class="editor-lines relative flex min-h-full w-full flex-row font-mono"
        style:min-height={minHeight || undefined}
        style:--editor-tab-size={preferences.indentSize}
        style:--editor-gutter-width={gutterWidth}>
        {#if preferences.showLineNumbers}
            <div
                class="editor-gutter-track pointer-events-none sticky left-0 z-10 box-border flex shrink-0 flex-col border-r border-line-subtle bg-canvas font-mono text-xs select-none"
                style:width="var(--editor-gutter-width)"
                style:min-width="var(--editor-gutter-width)"
                style:max-width="var(--editor-gutter-width)"
                aria-hidden="true">
                {#each { length: lineCount } as _, i (i)}
                    <div
                        class={cn(
                            'editor-gutter-num box-border flex items-start justify-center px-1 text-center font-mono leading-6 tabular-nums select-none',
                            cursor.line === i + 1 ?
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
                bind:this={pre}
                data-code-theme={theme}
                class="editor-pre pointer-events-none m-0! box-border! min-h-full! w-full! scrollbar-none overflow-x-auto! overflow-y-hidden! border-0! bg-transparent pt-0! pr-5! pb-5! pl-2! break-normal! wrap-normal! [word-break:normal]! whitespace-pre! select-none [-ms-overflow-style:none] [grid-area:editor] [&::-webkit-scrollbar]:hidden"><code
                    class="hljs language-markdown m-0! block! w-max! min-w-full! overflow-x-visible! p-0! wrap-normal! [word-break:normal]! whitespace-pre!"
                    data-code-theme={theme}
                    >{#each highlightedLines as lineHtml, i (i)}<div
                            class={cn(
                                'editor-code-line m-0! block! w-max! min-w-full! leading-6! wrap-normal! [word-break:normal]! whitespace-pre!',
                                cursor.line === i + 1 && 'editor-code-line-active'
                            )}>{@html lineHtml || '&nbsp;'}</div>{/each}</code></pre>

            <textarea
                bind:this={textarea}
                id="markdown-content"
                name="markdownContent"
                aria-label="Markdown content"
                {placeholder}
                bind:value
                onscroll={syncScroll}
                oninput={handleInput}
                onclick={updateCursor}
                onkeyup={updateCursor}
                onfocus={updateCursor}
                {onblur}
                onkeydown={handleKeyDown}
                class="editor-textarea m-0! box-border! h-full! min-h-full! w-full! resize-none! overflow-x-auto! overflow-y-hidden! border-0! bg-transparent! pt-0! pr-5! pb-5! pl-2! break-normal! wrap-normal! [word-break:normal]! whitespace-pre! text-transparent caret-fg outline-hidden! [grid-area:editor] placeholder:text-fg-muted/60 focus:border-transparent! focus:shadow-none! focus:ring-0 focus:outline-none focus-visible:border-transparent! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:outline-hidden!"
            ></textarea>
        </div>
    </div>
{:else}
    <div
        class="editor-lines relative flex min-h-full w-full flex-col font-mono"
        style:min-height={minHeight || undefined}
        style:--editor-tab-size={preferences.indentSize}
        style:--editor-gutter-width={gutterWidth}>
        {#if preferences.showLineNumbers}
            <div
                class="editor-gutter-track pointer-events-none absolute inset-y-0 left-0 z-10 box-border border-r font-mono text-xs"
                style:width="var(--editor-gutter-width)"
                style:min-width="var(--editor-gutter-width)"
                style:max-width="var(--editor-gutter-width)"
                aria-hidden="true">
            </div>
        {/if}
        <div class="relative grid min-h-full w-full [grid-template-areas:'editor']">
            <pre
                bind:this={pre}
                data-code-theme={theme}
                class="editor-pre pointer-events-none m-0! box-border! min-h-full! w-full! scrollbar-none overflow-hidden! border-0! bg-transparent pt-0! pr-0! pb-5! pl-0! break-normal! wrap-break-word! whitespace-pre-wrap! select-none [-ms-overflow-style:none] [grid-area:editor] [&::-webkit-scrollbar]:hidden"><code
                    class="hljs language-markdown m-0! block! w-full! min-w-full! overflow-x-visible! p-0! [overflow-wrap:inherit]! [word-break:inherit]! [white-space:inherit]!"
                    data-code-theme={theme}
                    >{#each highlightedLines as lineHtml, i (i)}<div
                            class={cn(
                                'editor-code-line m-0! flex! w-full! flex-row! items-stretch! p-0! leading-6! [overflow-wrap:inherit]! [word-break:inherit]! [white-space:inherit]!',
                                cursor.line === i + 1 && 'editor-code-line-active'
                            )}>{#if preferences.showLineNumbers}<span
                                    class={cn(
                                        'editor-gutter-num sticky left-0 z-20 box-border! inline-flex! shrink-0! items-start! justify-center! self-stretch! border-r px-1 text-center font-mono tabular-nums select-none',
                                        cursor.line === i + 1 ?
                                            'editor-line-number-active font-medium'
                                        :   'editor-gutter-muted'
                                    )}
                                    style:width="var(--editor-gutter-width)"
                                    style:min-width="var(--editor-gutter-width)"
                                    style:max-width="var(--editor-gutter-width)">{i + 1}</span
                                >{/if}<span
                                class="editor-line-content m-0! block! min-w-0! flex-1! pt-0! pr-5! pb-0! pl-2! leading-6! [overflow-wrap:inherit]! [word-break:inherit]! [white-space:inherit]!"
                                >{@html lineHtml || '&nbsp;'}</span></div>{/each}</code></pre>

            <textarea
                bind:this={textarea}
                id="markdown-content"
                name="markdownContent"
                aria-label="Markdown content"
                {placeholder}
                bind:value
                onscroll={syncScroll}
                oninput={handleInput}
                onclick={updateCursor}
                onkeyup={updateCursor}
                onfocus={updateCursor}
                {onblur}
                onkeydown={handleKeyDown}
                class="editor-textarea m-0! box-border! h-full! min-h-full! w-full! resize-none! overflow-hidden! border-0! bg-transparent! pt-0! pr-5! pb-5! break-normal! wrap-break-word! whitespace-pre-wrap! text-transparent caret-fg outline-hidden! [grid-area:editor] placeholder:text-fg-muted/60 focus:border-transparent! focus:shadow-none! focus:ring-0 focus:outline-none focus-visible:border-transparent! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:outline-hidden!"
                style:padding-left={preferences.showLineNumbers ?
                    'calc(var(--editor-gutter-width) + 0.5rem)'
                :   '0.5rem'}></textarea>
        </div>
    </div>
{/if}
