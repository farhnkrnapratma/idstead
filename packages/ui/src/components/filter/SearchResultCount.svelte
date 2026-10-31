<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { cn } from '../../utils/cn';

    interface Props {
        count: number;
        total: number;
        itemLabel?: string;
        loading?: boolean;
        class?: string;
    }

    let {
        count,
        total,
        itemLabel = 'items',
        loading = false,
        class: className = ''
    }: Props = $props();
</script>

{#if !loading && total > 0}
    <div
        class={cn('text-xs font-normal whitespace-nowrap text-fg-secondary select-none', className)}
        aria-live="polite"
        aria-atomic="true">
        Showing
        <span class="font-bold text-fg-accent">{count}</span>
        of
        <span class="font-bold text-fg-accent">{total}</span>
        {itemLabel}
    </div>
{/if}
