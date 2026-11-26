<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: MIT OR Apache-2.0
-->

<script lang="ts">
    import { FileUp, SlidersHorizontal } from '@lucide/svelte';
    import type { Snippet } from 'svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import Checkbox from '@idstead/ui/components/Checkbox.svelte';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import IconButton from '@idstead/ui/components/IconButton.svelte';
    import { INDENT_SIZES, type EditorPreferences, type IndentSize } from './preferences.svelte';

    interface Props {
        activeTab?: 'editor' | 'preview';
        preferences: EditorPreferences;
        importAccept?: string;
        onImport?: (file: File) => void;
        blocks?: Snippet;
    }

    let {
        activeTab = $bindable('editor'),
        preferences,
        importAccept = '.md,.mdrs,.markdown,text/markdown',
        onImport,
        blocks
    }: Props = $props();

    let importInput = $state<HTMLInputElement | null>(null);

    const segment = (active: boolean) =>
        cn(
            'touch-target relative inline-flex h-7 flex-1 cursor-pointer items-center justify-center rounded-sm px-2 font-mono text-xs transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
            active ? 'bg-accent-strong font-medium text-on-accent shadow-xs' : 'text-fg-secondary hover:bg-fg/5 hover:text-fg'
        );

    function handleImport(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (file) onImport?.(file);
    }
</script>

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
                class="editor-tab touch-target relative inline-flex h-7 cursor-pointer items-center rounded-sm px-3 font-mono text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none sm:px-4 {(
                    activeTab === 'editor'
                ) ?
                    'bg-accent-strong text-on-accent! shadow-xs'
                :   'editor-tab-inactive'}">
                Edit
            </button>
            <button
                type="button"
                onclick={() => (activeTab = 'preview')}
                role="tab"
                aria-selected={activeTab === 'preview'}
                class="editor-tab touch-target relative inline-flex h-7 cursor-pointer items-center rounded-sm px-3 font-mono text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none sm:px-4 {(
                    activeTab === 'preview'
                ) ?
                    'bg-accent-strong text-on-accent! shadow-xs'
                :   'editor-tab-inactive'}">
                Preview
            </button>
        </div>

        <div
            class="editor-tab-list ml-auto flex h-8 items-center gap-0.5 rounded-md border p-0.5"
            role="group"
            aria-label="Editor options">
            {#if onImport}
                <IconButton
                    ariaLabel="Import a Markdown or MDRS file"
                    tooltip="Import file"
                    variant="ghost"
                    size="2xs"
                    onclick={() => importInput?.click()}>
                    <FileUp class="size-4" />
                </IconButton>
                <input
                    bind:this={importInput}
                    type="file"
                    name="markdown-import"
                    accept={importAccept}
                    class="hidden"
                    aria-label="Import a Markdown or MDRS file"
                    onchange={handleImport} />
            {/if}
            {#if activeTab === 'editor'}
                {@render blocks?.()}
                <Dropdown
                    ariaLabel="View options"
                    placement="bottom-end">
                    {#snippet trigger({ isOpen, toggle })}
                        <IconButton
                            ariaLabel="View options"
                            tooltip="View options"
                            variant="ghost"
                            size="2xs"
                            class={cn(isOpen && 'bg-surface-hover text-fg')}
                            aria-haspopup="dialog"
                            aria-expanded={isOpen}
                            onclick={toggle}>
                            <SlidersHorizontal class="size-4" />
                        </IconButton>
                    {/snippet}
                    <div class="flex w-64 max-w-[calc(100vw-1rem)] flex-col gap-3 p-3 text-xs">
                        <section class="flex flex-col gap-2">
                            <h3 class="font-medium text-fg-muted">Display</h3>
                            <Checkbox
                                label="Wrap long lines"
                                checked={preferences.lineWrapMode === 'soft'}
                                onchange={() => preferences.toggleLineWrap()} />
                            <Checkbox
                                label="Line numbers"
                                checked={preferences.showLineNumbers}
                                onchange={() => preferences.toggleLineNumbers()} />
                        </section>
                        <div
                            class="h-px bg-line-subtle"
                            aria-hidden="true">
                        </div>
                        <section class="flex flex-col gap-2">
                            <h3 class="font-medium text-fg-muted">Indentation</h3>
                            <div
                                class="flex rounded-md border border-line-subtle p-0.5"
                                role="radiogroup"
                                aria-label="Indent with">
                                {#each ['spaces', 'tabs'] as const as mode (mode)}
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={preferences.indentMode === mode}
                                        class={segment(preferences.indentMode === mode)}
                                        onclick={() => {
                                            if (preferences.indentMode !== mode)
                                                preferences.toggleIndentMode();
                                        }}>
                                        {mode === 'spaces' ? 'Spaces' : 'Tabs'}
                                    </button>
                                {/each}
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="shrink-0 text-fg-muted">Width</span>
                                <div
                                    class="flex flex-1 rounded-md border border-line-subtle p-0.5"
                                    role="radiogroup"
                                    aria-label="Indent width">
                                    {#each INDENT_SIZES as size (size)}
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={preferences.indentSize === size}
                                            aria-label="{size} {preferences.indentMode === 'tabs' ? 'columns' : 'spaces'}"
                                            class={segment(preferences.indentSize === size)}
                                            onclick={() => preferences.setIndentSize(size as IndentSize)}>
                                            {size}
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        </section>
                    </div>
                </Dropdown>
            {/if}
        </div>
    </div>
</div>
