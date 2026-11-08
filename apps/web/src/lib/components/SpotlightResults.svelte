<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import ShortcutBadge from '@idstead/ui/components/ShortcutBadge.svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { elementRef } from '@idstead/ui/utils/elementRef.ts';
    import { COMMAND_SHORTCUTS } from '@idstead/ui/shortcuts.ts';
    import { ChevronLeft, ChevronRight, CornerDownLeft, SquareTerminal } from '@lucide/svelte';
    import { CATEGORY_ICONS } from './spotlight/icons';
    import type { ItemCategory, SpotlightItem } from './spotlight/types';
    import type { SearchHistoryEntry } from '../stores/searchHistoryStore.svelte';

    interface HistoryDisplay {
        icon: typeof SquareTerminal;
        title: string;
        subtitle?: string;
    }

    interface Group {
        category: ItemCategory;
        label: string;
        items: SpotlightItem[];
        page: number;
        pageCount: number | null;
        hasPrev: boolean;
        hasNext: boolean;
    }

    interface Props {
        activeIndex?: number;
        listEl?: HTMLElement | null;
        filteredHistory: SearchHistoryEntry[];
        categorizedResults: Group[];
        resultCount: number;
        isLoading: boolean;
        rawQuery: string;
        indexById: Map<string, number>;
        getHistoryDisplay: (entry: SearchHistoryEntry) => HistoryDisplay;
        getHighlightChunks: (text: string, query: string) => { text: string; match: boolean }[];
        handleHistoryKeydown: (event: KeyboardEvent, entry: SearchHistoryEntry) => void;
        handleItemPointerMove: (event: PointerEvent, index: number) => void;
        handleResultKeydown: (event: KeyboardEvent, item: SpotlightItem) => void;
        changeSectionPage: (category: ItemCategory, delta: number) => void;
        select: (item: SpotlightItem) => void;
        selectHistoryEntry: (entry: SearchHistoryEntry) => void;
    }

    let {
        activeIndex = $bindable(-1),
        listEl = $bindable(null),
        filteredHistory,
        categorizedResults,
        resultCount,
        isLoading,
        rawQuery,
        indexById,
        getHistoryDisplay,
        getHighlightChunks,
        handleHistoryKeydown,
        handleItemPointerMove,
        handleResultKeydown,
        changeSectionPage,
        select,
        selectHistoryEntry
    }: Props = $props();
</script>

<div
    {@attach elementRef<HTMLDivElement>(node => (listEl = node))}
    class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    {#if filteredHistory.length > 0}
        <div class={cn('px-2.5 pt-2.5', resultCount === 0 && 'pb-2.5')}>
            <div class="flex items-center justify-between gap-2 px-2 pb-1.5 select-none">
                <span class="text-xxs font-bold tracking-wider text-fg-muted"> Recents </span>
            </div>
            <div class="flex flex-col">
                {#each filteredHistory as entry, idx (entry.id)}
                    {@const historyDisplay = getHistoryDisplay(entry)}
                    {@const EntryIcon = historyDisplay.icon}
                    {@const historyShortcut = COMMAND_SHORTCUTS[historyDisplay.title.split(' ')[0]]}
                    {@const historyShortcutKey = historyShortcut ?? ''}
                    <div
                        id="result-{idx}"
                        role="option"
                        tabindex="0"
                        aria-selected={activeIndex === idx}
                        data-result-item
                        onfocus={() => (activeIndex = idx)}
                        onclick={() => selectHistoryEntry(entry)}
                        onkeydown={e => handleHistoryKeydown(e, entry)}
                        onpointermove={e => handleItemPointerMove(e, idx)}
                        class={cn(
                            'group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md px-2 py-1 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                            activeIndex === idx ?
                                'bg-accent/10 text-fg dark:bg-accent/20'
                            :   'text-fg-secondary hover:bg-surface-hover hover:text-fg'
                        )}>
                        <div class="flex min-w-0 flex-1 items-center gap-1.5">
                            <div
                                class={cn(
                                    'flex size-5 shrink-0 items-center justify-center transition-colors select-none',
                                    activeIndex === idx ? 'text-fg-accent' : (
                                        'text-fg-secondary group-hover:text-fg-accent'
                                    )
                                )}>
                                <EntryIcon class="size-3.5" />
                            </div>

                            {#if historyDisplay.title.startsWith('/')}
                                {@const spaceIdx = historyDisplay.title.indexOf(' ')}
                                {@const verb =
                                    spaceIdx === -1 ?
                                        historyDisplay.title
                                    :   historyDisplay.title.slice(0, spaceIdx)}
                                {@const args =
                                    spaceIdx === -1 ? '' : historyDisplay.title.slice(spaceIdx)}
                                <div class="flex min-w-0 flex-1 items-center gap-2">
                                    <span class="shrink-0 text-xs">
                                        {#each getHighlightChunks(verb, rawQuery) as chunk, cIdx (cIdx)}<span
                                                class={chunk.match ?
                                                    'font-semibold text-fg-accent'
                                                :   'font-medium text-fg'}>{chunk.text}</span
                                            >{/each}{#if args}{#each getHighlightChunks(args, rawQuery) as chunk, cIdx (cIdx)}<span
                                                    class={chunk.match ?
                                                        'font-semibold text-fg-accent'
                                                    :   'font-normal text-fg-muted/60'}
                                                    >{chunk.text}</span
                                                >{/each}{/if}
                                    </span>
                                    {#if historyDisplay.subtitle}
                                        <span class="text-2xs text-fg-muted/40 select-none">—</span>
                                        <span
                                            class="min-w-0 flex-1 truncate font-sans text-2xs text-fg-muted">
                                            {#each getHighlightChunks(historyDisplay.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                                                {#if chunk.match}
                                                    <span class="font-semibold text-fg-accent"
                                                        >{chunk.text}</span>
                                                {:else}
                                                    <span>{chunk.text}</span>
                                                {/if}
                                            {/each}
                                        </span>
                                    {/if}
                                </div>
                            {:else}
                                <div class="flex min-w-0 flex-1 items-center gap-2">
                                    <span
                                        class="max-w-[45%] shrink-0 truncate text-xs font-medium text-fg sm:max-w-[55%]">
                                        {#each getHighlightChunks(historyDisplay.title, rawQuery) as chunk, cIdx (cIdx)}
                                            <span
                                                class={chunk.match ?
                                                    'font-semibold text-fg-accent'
                                                :   ''}>{chunk.text}</span>
                                        {/each}
                                    </span>
                                    {#if historyDisplay.subtitle}
                                        <span class="text-2xs text-fg-muted/40 select-none">—</span>
                                        <span
                                            class="min-w-0 flex-1 truncate font-sans text-2xs text-fg-muted">
                                            {#each getHighlightChunks(historyDisplay.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                                                {#if chunk.match}
                                                    <span class="font-semibold text-fg-accent"
                                                        >{chunk.text}</span>
                                                {:else}
                                                    <span>{chunk.text}</span>
                                                {/if}
                                            {/each}
                                        </span>
                                    {/if}
                                </div>
                            {/if}
                        </div>

                        <div class="flex shrink-0 items-center gap-0.5">
                            {#if historyShortcut}
                                <ShortcutBadge
                                    combo={historyShortcutKey}
                                    leader
                                    active={activeIndex === idx} />
                            {/if}
                            <span
                                aria-hidden="true"
                                class="flex size-5 shrink-0 items-center justify-center">
                                <CornerDownLeft
                                    strokeWidth={1.5}
                                    class={cn(
                                        'size-3 text-fg-accent group-hover:visible',
                                        activeIndex === idx ? 'visible' : 'invisible'
                                    )} />
                            </span>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    {#if isLoading && resultCount === 0}
        <div class="space-y-2 p-3">
            {#each [1, 2, 3] as placeholderId (placeholderId)}
                <div
                    class="flex animate-pulse items-center gap-3 rounded-md border border-line-subtle bg-surface-hover p-2.5 select-none">
                    <div class="size-4 shrink-0 rounded-md bg-line"></div>
                    <div class="flex-1 space-y-1.5">
                        <div class="h-3 w-2/5 rounded bg-line"></div>
                        <div class="h-2.5 w-3/5 rounded bg-line-subtle"></div>
                    </div>
                </div>
            {/each}
        </div>
    {:else if resultCount === 0 && filteredHistory.length === 0}
        {#if rawQuery.length === 0}
            <div
                class="flex h-full flex-col items-center justify-center gap-1 px-4 py-8 text-center select-none">
                <p class="text-xs font-medium text-fg-muted">Search or run any commands</p>
                <p class="text-2xs text-fg-muted">
                    Type <span class="text-fg-accent">/</span> for commands, or
                    <span class="text-fg-accent">/help</span> for the guide
                </p>
            </div>
        {:else}
            <div
                class="flex h-full flex-col items-center justify-center px-4 py-10 text-center select-none">
                <p class="text-xs font-medium text-fg-muted">No results found</p>
            </div>
        {/if}
    {:else if resultCount > 0}
        <div
            id="search-results"
            role="listbox"
            aria-label="Search results"
            class="scrollbar-none px-2.5 pb-2.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {#each categorizedResults as group, gIdx (group.category)}
                <div
                    class={cn(
                        'px-2 pb-1.5 select-none',
                        filteredHistory.length > 0 || gIdx > 0 ? 'pt-1.5' : 'pt-2.5'
                    )}>
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xxs font-bold tracking-wider text-fg-muted">
                            {group.label}
                        </span>
                        {#if group.hasPrev || group.hasNext}
                            <div class="flex items-center gap-1 text-2xs text-fg-muted">
                                <button
                                    type="button"
                                    aria-label="Previous {group.label} page"
                                    disabled={!group.hasPrev}
                                    onclick={() => changeSectionPage(group.category, -1)}
                                    class="inline-flex size-5 cursor-pointer items-center justify-center rounded-sm hover:bg-surface-hover disabled:cursor-default disabled:opacity-40">
                                    <ChevronLeft class="size-3" />
                                </button>
                                <span class="min-w-8 text-center tabular-nums">
                                    {group.pageCount ?
                                        `${group.page} / ${group.pageCount}`
                                    :   group.page}
                                </span>
                                <button
                                    type="button"
                                    aria-label="Next {group.label} page"
                                    disabled={!group.hasNext}
                                    onclick={() => changeSectionPage(group.category, 1)}
                                    class="inline-flex size-5 cursor-pointer items-center justify-center rounded-sm hover:bg-surface-hover disabled:cursor-default disabled:opacity-40">
                                    <ChevronRight class="size-3" />
                                </button>
                            </div>
                        {/if}
                    </div>
                </div>
                <div class="flex flex-col">
                    {#each group.items as item (item.id)}
                        {@const globalIdx = (indexById.get(item.id) ?? 0) + filteredHistory.length}
                        {@const ItemIcon =
                            item.icon ?? CATEGORY_ICONS[item.category] ?? SquareTerminal}
                        <div
                            id="result-{globalIdx}"
                            role="option"
                            tabindex="0"
                            aria-selected={activeIndex === globalIdx}
                            data-result-item
                            onfocus={() => (activeIndex = globalIdx)}
                            onclick={() => select(item)}
                            onkeydown={e => handleResultKeydown(e, item)}
                            onpointermove={e => handleItemPointerMove(e, globalIdx)}
                            class={cn(
                                'group relative flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md px-2 py-1 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                                activeIndex === globalIdx ?
                                    'bg-accent/10 text-fg dark:bg-accent/20'
                                :   'text-fg-secondary hover:bg-surface-hover hover:text-fg'
                            )}>
                            <div class="flex min-w-0 flex-1 items-center gap-1.5">
                                <div
                                    class={cn(
                                        'flex size-5 shrink-0 items-center justify-center transition-colors select-none',
                                        activeIndex === globalIdx ? 'text-fg-accent' : (
                                            'text-fg-secondary group-hover:text-fg-accent'
                                        )
                                    )}>
                                    <ItemIcon class="size-3.5" />
                                </div>

                                {#if item.title.startsWith('/')}
                                    {@const spaceIdx = item.title.indexOf(' ')}
                                    {@const verb =
                                        spaceIdx === -1 ?
                                            item.title
                                        :   item.title.slice(0, spaceIdx)}
                                    {@const args =
                                        spaceIdx === -1 ? '' : item.title.slice(spaceIdx)}
                                    <div class="flex min-w-0 flex-1 items-center gap-2">
                                        <span class="shrink-0 text-xs">
                                            {#each getHighlightChunks(verb, rawQuery) as chunk, cIdx (cIdx)}<span
                                                    class={chunk.match ?
                                                        'font-semibold text-fg-accent'
                                                    :   'font-medium text-fg'}>{chunk.text}</span
                                                >{/each}{#if args}{#each getHighlightChunks(args, rawQuery) as chunk, cIdx (cIdx)}<span
                                                        class={chunk.match ?
                                                            'font-semibold text-fg-accent'
                                                        :   'font-normal text-fg-muted/60'}
                                                        >{chunk.text}</span
                                                    >{/each}{/if}
                                        </span>
                                        {#if item.subtitle}
                                            <span class="text-2xs text-fg-muted/40 select-none"
                                                >—</span>
                                            <span
                                                class="min-w-0 flex-1 truncate font-sans text-2xs text-fg-muted">
                                                {#each getHighlightChunks(item.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                                                    {#if chunk.match}
                                                        <span class="font-semibold text-fg-accent"
                                                            >{chunk.text}</span>
                                                    {:else}
                                                        <span>{chunk.text}</span>
                                                    {/if}
                                                {/each}
                                            </span>
                                        {/if}
                                    </div>
                                {:else}
                                    <div class="flex min-w-0 flex-1 items-center gap-2">
                                        <span
                                            class="max-w-[45%] shrink-0 truncate text-xs font-medium text-fg sm:max-w-[55%]">
                                            {#each getHighlightChunks(item.title, rawQuery) as chunk, cIdx (cIdx)}
                                                <span
                                                    class={chunk.match ?
                                                        'font-semibold text-fg-accent'
                                                    :   ''}>{chunk.text}</span>
                                            {/each}
                                        </span>
                                        {#if item.subtitle}
                                            <span class="text-2xs text-fg-muted/40 select-none"
                                                >—</span>
                                            <span
                                                class="min-w-0 flex-1 truncate font-sans text-2xs text-fg-muted">
                                                {#each getHighlightChunks(item.subtitle, rawQuery) as chunk, cIdx (cIdx)}
                                                    {#if chunk.match}
                                                        <span class="font-semibold text-fg-accent"
                                                            >{chunk.text}</span>
                                                    {:else}
                                                        <span>{chunk.text}</span>
                                                    {/if}
                                                {/each}
                                            </span>
                                        {/if}
                                    </div>
                                {/if}
                            </div>

                            <div class="flex shrink-0 items-center gap-0.5">
                                {#if COMMAND_SHORTCUTS[item.title]}
                                    <ShortcutBadge
                                        combo={COMMAND_SHORTCUTS[item.title]}
                                        leader
                                        active={activeIndex === globalIdx} />
                                {/if}
                                <span
                                    aria-hidden="true"
                                    class="flex size-5 shrink-0 items-center justify-center">
                                    <CornerDownLeft
                                        strokeWidth={1.5}
                                        class={cn(
                                            'size-3 text-fg-accent group-hover:visible',
                                            activeIndex === globalIdx ? 'visible' : 'invisible'
                                        )} />
                                </span>
                            </div>
                        </div>
                    {/each}
                </div>
            {/each}
        </div>
    {/if}
</div>
