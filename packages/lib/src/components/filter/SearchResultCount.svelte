<script lang="ts">
    import { cn } from '../../utils/cn';
    import SkeletonBlock from '../SkeletonBlock.svelte';

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

<div
    class={cn('text-xs font-normal whitespace-nowrap text-text-secondary select-none', className)}
    aria-live="polite"
    aria-atomic="true"
    aria-busy={loading}>
    {#if loading}
        <span class="sr-only">Loading counts…</span>
    {/if}
    Showing
    {#if loading}
        <SkeletonBlock
            height="h-3"
            width="w-5"
            class="inline-block align-middle" />
    {:else}
        <span class="font-bold text-accent">{count}</span>
    {/if}
    of
    {#if loading}
        <SkeletonBlock
            height="h-3"
            width="w-5"
            class="inline-block align-middle" />
    {:else}
        <span class="font-bold text-accent">{total}</span>
    {/if}
    {itemLabel}
</div>
