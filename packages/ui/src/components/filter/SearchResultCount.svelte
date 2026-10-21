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
        class={cn(
            'text-xs font-normal whitespace-nowrap text-text-secondary select-none',
            className
        )}
        aria-live="polite"
        aria-atomic="true">
        Showing
        <span class="font-bold text-accent-text">{count}</span>
        of
        <span class="font-bold text-accent-text">{total}</span>
        {itemLabel}
    </div>
{/if}
