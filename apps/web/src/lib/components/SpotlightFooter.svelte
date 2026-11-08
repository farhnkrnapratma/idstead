<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import ShortcutBadge from '@idstead/ui/components/ShortcutBadge.svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { KEY_GROUP_CLASS, KEY_SEGMENT_CLASS } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { ArrowUpDown, CornerDownLeft } from '@lucide/svelte';

    interface Props {
        isLoading: boolean;
        query: string;
        resultCount: number;
        hasPages: boolean;
    }

    let { isLoading, query, resultCount, hasPages }: Props = $props();
</script>

{#snippet iconKey(Icon: typeof ArrowUpDown)}
    <span
        class={KEY_GROUP_CLASS}
        aria-hidden="true">
        <kbd class={cn(KEY_SEGMENT_CLASS, 'border-line-subtle bg-surface text-fg-secondary')}>
            <Icon class="size-2.5" />
        </kbd>
    </span>
{/snippet}

<div
    class="hidden flex-none items-center justify-between gap-2 border-t border-line-subtle px-3.5 py-2 text-2xs select-none sm:flex">
    <div
        class="flex min-w-0 flex-1 items-center gap-3 text-2xs leading-none font-medium text-fg-muted">
        {#if isLoading}
            <span>Searching…</span>
        {:else if query.trim()}
            <span>
                {resultCount}
                result{resultCount === 1 ? '' : 's'}
            </span>
        {/if}
    </div>
    <div class="flex shrink-0 items-center gap-2.5 text-2xs leading-none font-medium text-fg-muted">
        <span class="flex items-center gap-1">
            {@render iconKey(ArrowUpDown)}
            <span class="hidden sm:inline">navigate</span>
        </span>
        {#if hasPages}
            <span class="flex items-center gap-1">
                <ShortcutBadge combo="PageUp" />
                <ShortcutBadge combo="PageDown" />
                <span class="hidden sm:inline">page</span>
            </span>
        {/if}
        <span class="flex items-center gap-1">
            {@render iconKey(CornerDownLeft)}
            <span class="hidden sm:inline">execute</span>
        </span>
        <span class="flex items-center gap-1">
            <ShortcutBadge combo="Esc" />
            <span class="hidden sm:inline">close</span>
        </span>
    </div>
</div>
