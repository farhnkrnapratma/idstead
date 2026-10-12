<script lang="ts">
    import { X } from '@lucide/svelte';
    import { cn } from '../../utils/cn';

    interface Props {
        label: string;
        value: string;
        onRemove?: () => void;
        class?: string;
    }

    let { label, value, onRemove = () => {}, class: className = '' }: Props = $props();
</script>

<div
    class={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-xs font-medium text-accent shadow-2xs select-none',
        className
    )}>
    {#if label !== 'tag'}
        <span class="text-accent/75">{label}:</span>
    {/if}
    <span class="min-w-0 wrap-break-word">{value}</span>
    <button
        type="button"
        onclick={onRemove}
        aria-label="Remove filter: {label} {value}"
        class="inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full p-0 text-accent/60 transition-colors hover:bg-accent/20 hover:text-accent focus:outline-none active:text-accent">
        <X class="size-2.5" />
    </button>
</div>
