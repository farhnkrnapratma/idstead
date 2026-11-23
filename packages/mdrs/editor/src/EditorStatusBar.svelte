<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: MIT OR Apache-2.0
-->

<script lang="ts">
    import {
        CircleCheck,
        CircleX,
        ListIndentIncrease,
        RefreshCw,
        RefreshCwOff,
        TriangleAlert
    } from '@lucide/svelte';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import Tooltip from '@idstead/ui/components/Tooltip.svelte';
    import { pluralize } from '@idstead/domain/pluralize.ts';
    import type { EditorPreferences } from './preferences.svelte';
    import type { EditorProblem } from './problems';

    interface Props {
        preferences: EditorPreferences;
        line: number;
        column: number;
        lineEnding: 'LF' | 'CRLF';
        problems: EditorProblem[];
        showAutosave: boolean;
        stickyClass: string;
        onFocusEditor: () => void;
        onGoTo: (problem: EditorProblem) => void;
    }

    let {
        preferences,
        line,
        column,
        lineEnding,
        problems,
        showAutosave,
        stickyClass,
        onFocusEditor,
        onGoTo
    }: Props = $props();

    const autosaveState = $derived(preferences.autosaveEnabled ? 'on' : 'off');
    const errorCount = $derived(problems.filter(problem => problem.severity === 'error').length);
    const warningCount = $derived(problems.length - errorCount);
    const problemSummary = $derived(
        problems.length ?
            `${pluralize(errorCount, 'error')}, ${pluralize(warningCount, 'warning')}`
        :   'No problems'
    );
</script>

<div
    class="editor-chrome editor-status-bar sticky {stickyClass} z-20 flex min-h-8 items-center justify-between gap-3 rounded-b-md border-t px-3 font-mono text-xxs select-none sm:px-4">
    <div class="flex min-w-0 items-center gap-3 overflow-x-auto">
        <Dropdown
            ariaLabel="Problems"
            placement="top-start">
            {#snippet trigger({ isOpen, toggle })}
                <button
                    type="button"
                    onclick={toggle}
                    aria-label="Problems: {problemSummary}"
                    aria-haspopup="dialog"
                    aria-expanded={isOpen}
                    class="touch-target relative inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                    {#if problems.length}
                        <span class="inline-flex items-center gap-1">
                            <CircleX class="size-3 text-fg-danger" />
                            {errorCount}
                        </span>
                        <span class="inline-flex items-center gap-1">
                            <TriangleAlert class="size-3 text-fg-warning" />
                            {warningCount}
                        </span>
                    {:else}
                        <CircleCheck class="size-3 text-fg-success" />
                        <span class="hidden sm:inline">No problems</span>
                    {/if}
                </button>
            {/snippet}
            {#snippet children({ close })}
                <div class="flex max-h-72 w-md max-w-[calc(100vw-1rem)] flex-col text-xs">
                    <p class="border-b border-line-subtle px-3 py-2 font-medium text-fg-muted">
                        {problemSummary}
                    </p>
                    {#if problems.length}
                        <ul class="overflow-y-auto py-1">
                            {#each problems as problem, index (index)}
                                <li>
                                    <button
                                        type="button"
                                        onclick={() => {
                                            close();
                                            onGoTo(problem);
                                        }}
                                        class="flex w-full cursor-pointer items-start gap-2 px-3 py-1.5 text-left hover:bg-fg/5 focus-visible:bg-fg/5 focus-visible:outline-none">
                                        {#if problem.severity === 'error'}
                                            <CircleX class="mt-0.5 size-3.5 shrink-0 text-fg-danger" />
                                        {:else}
                                            <TriangleAlert
                                                class="mt-0.5 size-3.5 shrink-0 text-fg-warning" />
                                        {/if}
                                        <span class="min-w-0 flex-1 wrap-break-word">
                                            {problem.message}
                                        </span>
                                        <span class="shrink-0 font-mono text-fg-muted tabular-nums">
                                            {problem.line}:{problem.column}
                                        </span>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {:else}
                        <p class="px-3 py-2 text-fg-muted">
                            MDRS checks this document as you type.
                        </p>
                    {/if}
                </div>
            {/snippet}
        </Dropdown>
        <span class="editor-theme-foreground shrink-0">Ln {line}, Col {column}</span>
        <span class="flex shrink-0 items-center gap-1">
            <ListIndentIncrease class="hidden size-3 sm:inline-flex" />
            <span class="sm:hidden">
                {preferences.indentMode === 'tabs' ? 'T' : `S: ${preferences.indentSize}`}
            </span>
            <span class="hidden sm:inline">
                {preferences.indentMode === 'tabs' ? 'Tabs' : `Spaces: ${preferences.indentSize}`}
            </span>
        </span>
        <span class="shrink-0">UTF-8</span>
        <span class="shrink-0">{lineEnding}</span>
    </div>
    {#if showAutosave}
        <div class="flex shrink-0 items-center gap-2">
            <div class="hidden items-center gap-2 sm:flex">
                <Tooltip content="Autosave: {autosaveState}">
                    <button
                        type="button"
                        onclick={() => preferences.toggleAutosave()}
                        aria-pressed={preferences.autosaveEnabled}
                        class="touch-target relative inline-flex cursor-pointer items-center gap-1.5 rounded-md text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                        <span>Autosave</span>
                    </button>
                </Tooltip>
                <span
                    role="status"
                    aria-live="polite">
                    [{autosaveState}]
                </span>
            </div>
            <Tooltip content="Autosave: {autosaveState}">
                <button
                    type="button"
                    onclick={() => preferences.toggleAutosave()}
                    aria-pressed={preferences.autosaveEnabled}
                    aria-label="Autosave: {autosaveState}"
                    class="touch-target relative inline-flex cursor-pointer items-center gap-1.5 rounded-md text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:hidden">
                    {#if preferences.autosaveEnabled}
                        <RefreshCw class="size-3" />
                    {:else}
                        <RefreshCwOff class="size-3" />
                    {/if}
                </button>
            </Tooltip>
            <Tooltip content="Styling with MDRS is supported">
                <button
                    type="button"
                    onclick={onFocusEditor}
                    class="touch-target relative inline-flex cursor-pointer items-center gap-1.5 rounded-md text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                    <i
                        class="bi bi-markdown-fill inline-flex size-3 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                    <span class="hidden sm:inline">MDRS</span>
                </button>
            </Tooltip>
        </div>
    {/if}
</div>
