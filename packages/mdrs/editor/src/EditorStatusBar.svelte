<script lang="ts">
    import { ListIndentIncrease, RefreshCw, RefreshCwOff } from '@lucide/svelte';
    import Tooltip from '@idstead/ui/components/Tooltip.svelte';
    import type { EditorPreferences } from './preferences.svelte';

    interface Props {
        preferences: EditorPreferences;
        line: number;
        column: number;
        lineEnding: 'LF' | 'CRLF';
        showAutosave: boolean;
        onFocusEditor: () => void;
    }

    let { preferences, line, column, lineEnding, showAutosave, onFocusEditor }: Props = $props();

    const autosaveState = $derived(preferences.autosaveEnabled ? 'on' : 'off');
</script>

<div
    class="editor-chrome editor-status-bar sticky bottom-0 z-20 flex min-h-8 items-center justify-between gap-3 rounded-b-md border-t px-3 font-mono text-xxs select-none sm:px-4">
    <div class="flex min-w-0 items-center gap-3 overflow-x-auto">
        <span class="editor-theme-foreground shrink-0">Ln {line}, Col {column}</span>
        <span class="flex shrink-0 items-center gap-1">
            <ListIndentIncrease class="hidden size-3 sm:inline-flex" />
            <span class="sm:hidden"
                >{preferences.indentMode === 'tabs' ? 'T' : `S: ${preferences.indentSize}`}</span>
            <span class="hidden sm:inline"
                >{preferences.indentMode === 'tabs' ?
                    'Tabs'
                :   `Spaces: ${preferences.indentSize}`}</span>
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
                    aria-live="polite">[{autosaveState}]</span>
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
            <Tooltip content="Styling with Markdown is supported">
                <button
                    type="button"
                    onclick={onFocusEditor}
                    class="touch-target relative inline-flex cursor-pointer items-center gap-1.5 rounded-md text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                    <i
                        class="bi bi-markdown-fill inline-flex size-3 items-center justify-center text-xs leading-none [&::before]:align-[0] [&::before]:leading-none"
                        aria-hidden="true"></i>
                    <span class="hidden sm:inline">Markdown</span>
                </button>
            </Tooltip>
        </div>
    {/if}
</div>
