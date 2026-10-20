<script lang="ts">
    import {
        ArrowRightToLine,
        Bolt,
        FileUp,
        ListOrdered,
        RulerDimensionLine,
        Space,
        Summary,
        TextAlignJustify,
        TextWrap
    } from '@lucide/svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import IconButton from '@idstead/ui/components/IconButton.svelte';
    import Dropdown from '@idstead/ui/components/Dropdown.svelte';
    import { INDENT_SIZES, type EditorPreferences, type IndentSize } from './preferences.svelte';

    interface Props {
        activeTab?: 'editor' | 'preview';
        preferences: EditorPreferences;
        importAccept?: string;
        onImport?: (file: File) => void;
    }

    let {
        activeTab = $bindable('editor'),
        preferences,
        importAccept = '.md,.mdrs,.markdown,text/markdown',
        onImport
    }: Props = $props();

    let importInput = $state<HTMLInputElement | null>(null);

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
                    'bg-accent-contrast-bg text-text-on-accent! shadow-xs'
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
                    'bg-accent-contrast-bg text-text-on-accent! shadow-xs'
                :   'editor-tab-inactive'}">
                Preview
            </button>
        </div>

        <div class="ml-auto flex items-center gap-1 select-none">
            {#if onImport}
                <IconButton
                    ariaLabel="Import a Markdown or MDRS file"
                    tooltip="Import .md or .mdrs file"
                    size="sm"
                    class="editor-control-button"
                    onclick={() => importInput?.click()}>
                    <FileUp class="size-3.5" />
                </IconButton>
                <input
                    bind:this={importInput}
                    type="file"
                    accept={importAccept}
                    class="hidden"
                    aria-label="Import a Markdown or MDRS file"
                    onchange={handleImport} />
            {/if}
            {#if activeTab === 'editor'}
                <div class="hidden items-center gap-1 sm:flex">
                    <IconButton
                        ariaLabel="Indent mode: {preferences.indentMode === 'spaces' ?
                            'Spaces'
                        :   'Tabs'}"
                        tooltip="Indent mode: {preferences.indentMode === 'spaces' ?
                            'Spaces'
                        :   'Tabs'}"
                        size="sm"
                        class="editor-control-button"
                        onclick={() => preferences.toggleIndentMode()}>
                        {#if preferences.indentMode === 'spaces'}
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
                        value={preferences.indentSize}
                        onChange={(size: IndentSize) => preferences.setIndentSize(size)}>
                        {#snippet trigger({ isOpen, toggle })}
                            <IconButton
                                ariaLabel="Indent size: {preferences.indentSize} spaces"
                                tooltip="Indent size: {preferences.indentSize}"
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
                        ariaLabel="Line wrapping: {preferences.lineWrapMode === 'soft' ?
                            'Wrap'
                        :   'Nowrap'}"
                        tooltip="Line wrapping: {preferences.lineWrapMode === 'soft' ?
                            'Wrap'
                        :   'Nowrap'}"
                        size="sm"
                        class="editor-control-button"
                        onclick={() => preferences.toggleLineWrap()}>
                        {#if preferences.lineWrapMode === 'soft'}
                            <TextWrap class="size-3.5" />
                        {:else}
                            <Summary class="size-3.5" />
                        {/if}
                    </IconButton>
                    <IconButton
                        ariaLabel="Line numbers: {preferences.showLineNumbers ? 'on' : 'off'}"
                        tooltip="Line numbers: {preferences.showLineNumbers ? 'on' : 'off'}"
                        size="sm"
                        class="editor-control-button"
                        onclick={() => preferences.toggleLineNumbers()}>
                        {#if preferences.showLineNumbers}
                            <ListOrdered class="size-3.5" />
                        {:else}
                            <TextAlignJustify class="size-3.5" />
                        {/if}
                    </IconButton>
                </div>

                <div class="flex items-center sm:hidden">
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
                                    ariaLabel="Indent mode: {preferences.indentMode === 'spaces' ?
                                        'Spaces'
                                    :   'Tabs'}"
                                    size="xs"
                                    class="text-text-secondary hover:text-accent-text"
                                    onclick={() => preferences.toggleIndentMode()}>
                                    {#if preferences.indentMode === 'spaces'}
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
                                            aria-pressed={preferences.indentSize === size}
                                            onclick={() => preferences.setIndentSize(size)}
                                            class={cn(
                                                'touch-target relative inline-flex cursor-pointer items-center justify-center rounded-md px-2.5 py-1 transition-colors hover:bg-surface-hover hover:text-accent-text',
                                                preferences.indentSize === size ?
                                                    'bg-accent/10 font-semibold text-accent-text'
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
                                    ariaLabel="Line wrapping: {preferences.lineWrapMode === 'soft' ?
                                        'Wrap'
                                    :   'Nowrap'}"
                                    size="xs"
                                    class="text-text-secondary hover:text-accent-text"
                                    onclick={() => preferences.toggleLineWrap()}>
                                    {#if preferences.lineWrapMode === 'soft'}
                                        <TextWrap class="size-3.5" />
                                    {:else}
                                        <Summary class="size-3.5" />
                                    {/if}
                                </IconButton>
                            </div>
                            <div class="flex items-center justify-between gap-3 px-3 py-1.5">
                                <span class="text-text-muted">Line numbers</span>
                                <IconButton
                                    ariaLabel="Line numbers: {preferences.showLineNumbers ? 'on' : (
                                        'off'
                                    )}"
                                    size="xs"
                                    class="text-text-secondary hover:text-accent-text"
                                    onclick={() => preferences.toggleLineNumbers()}>
                                    {#if preferences.showLineNumbers}
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
</div>
