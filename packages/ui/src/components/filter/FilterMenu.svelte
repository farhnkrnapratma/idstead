<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { getContext } from 'svelte';
    import { Check, FunnelX, ListFilter, Square, SquareCheck } from '@lucide/svelte';
    import { cn } from '../../utils/cn';
    import Dropdown from '../Dropdown.svelte';
    import IconButton from '../IconButton.svelte';
    import Input from '../Input.svelte';
    import { activeFilterCount, type FilterMenuGroup } from './filterMenu';
    import { FILTER_TOOLBAR_CONTROL_SIZE, type FilterToolbarContext } from './filterToolbarContext';

    interface Props {
        groups: FilterMenuGroup[];
        label?: string;
        onClear?: () => void;
        class?: string;
    }

    let { groups, label = 'Filters', onClear, class: className = '' }: Props = $props();

    const filterToolbar = getContext<FilterToolbarContext | undefined>(FILTER_TOOLBAR_CONTROL_SIZE);
    const size = $derived(filterToolbar?.controlSize ?? 'md');
    const visibleGroups = $derived(groups.filter(group => group.options.length > 0));
    const activeCount = $derived(activeFilterCount(visibleGroups));
    const searchOnly = $derived(visibleGroups.length === 1 && !!visibleGroups[0].searchable);

    let queries = $state<Record<string, string>>({});

    function visibleOptions(group: FilterMenuGroup) {
        const query = (queries[group.label] ?? '').trim().toLowerCase();
        return query ?
                group.options.filter(option => option.label.toLowerCase().includes(query))
            :   group.options;
    }
</script>

<Dropdown
    ariaLabel={label}
    placement="bottom-end"
    onOpenChange={open => {
        if (open) queries = {};
    }}
    class={className}>
    {#snippet trigger({ isOpen, toggle })}
        <span class="relative inline-flex shrink-0">
            <IconButton
                ariaLabel={activeCount > 0 ? `${label}, ${activeCount} active` : label}
                tooltip={label}
                tooltipPlacement="bottom"
                tooltipAlign="right"
                {size}
                onclick={toggle}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                class={cn(
                    'text-fg-secondary hover:text-fg-accent',
                    (isOpen || activeCount > 0) && 'border-accent/30 text-fg-accent'
                )}>
                <ListFilter class="size-4" />
            </IconButton>
            {#if activeCount > 0}
                <span
                    aria-hidden="true"
                    class="pointer-events-none absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-accent px-1 text-2xs leading-none font-semibold text-on-accent">
                    {activeCount}
                </span>
            {/if}
        </span>
    {/snippet}
    <div class="flex max-h-[min(70vh,28rem)] w-64 max-w-[calc(100vw-1rem)] flex-col">
        <div class="flex flex-col overflow-y-auto">
            {#each visibleGroups as group, index (group.label)}
                {#if index > 0}
                    <hr class="my-1 border-line-subtle" />
                {/if}
                {#if !searchOnly}
                    <p
                        class="px-3 pt-1.5 pb-1 text-2xs font-semibold tracking-wider text-fg-muted uppercase">
                        {group.label}
                    </p>
                {/if}
                {#if group.searchable}
                    <div class="px-1.5 pb-1">
                        <Input
                            type="search"
                            size="sm"
                            placeholder={group.searchPlaceholder ?? 'Search...'}
                            bind:value={
                                () => queries[group.label] ?? '',
                                value => (queries[group.label] = value)
                            }
                            aria-label="Search {group.label.toLowerCase()}" />
                    </div>
                {/if}
                <div
                    role="group"
                    aria-label={group.label}
                    class={cn(
                        'flex flex-col',
                        group.searchable && !searchOnly && 'max-h-48 shrink-0 overflow-y-auto'
                    )}>
                    {#each visibleOptions(group) as option (option.value)}
                        {@const selected = group.selected.includes(option.value)}
                        <button
                            type="button"
                            aria-pressed={selected}
                            onclick={() => group.onSelect(option.value)}
                            class={cn(
                                'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none',
                                selected ?
                                    'bg-accent/10 font-semibold text-fg-accent'
                                :   'text-fg hover:bg-surface-hover hover:text-fg-accent focus-visible:bg-surface-hover focus-visible:text-fg-accent'
                            )}>
                            {#if group.mode === 'multi'}
                                {#if selected}
                                    <SquareCheck class="size-3.5 shrink-0 text-fg-accent" />
                                {:else}
                                    <Square class="size-3.5 shrink-0 text-fg-muted" />
                                {/if}
                            {/if}
                            <span class="min-w-0 flex-1 truncate">{option.label}</span>
                            {#if group.mode === 'single' && selected}
                                <Check class="size-3.5 shrink-0 text-fg-accent" />
                            {/if}
                        </button>
                    {:else}
                        <p class="px-3 py-3 text-center text-2xs text-fg-muted">No matches found</p>
                    {/each}
                </div>
            {/each}
        </div>
        {#if onClear && activeCount > 0}
            <div class="border-t border-line-subtle p-1">
                <button
                    type="button"
                    onclick={onClear}
                    class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-accent focus-visible:bg-surface-hover focus-visible:text-fg-accent focus-visible:outline-none">
                    <FunnelX class="size-3.5" />
                    Clear filters
                </button>
            </div>
        {/if}
    </div>
</Dropdown>
