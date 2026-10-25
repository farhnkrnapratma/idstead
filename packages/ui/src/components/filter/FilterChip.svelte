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
        'inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent/10 py-1 pr-1 pl-2 text-xs font-medium text-fg-accent shadow-2xs select-none',
        className
    )}>
    {#if label !== 'tag'}
        <span class="font-normal">{label}:</span>
    {/if}
    <span class="min-w-0 wrap-break-word">{value}</span>
    <button
        type="button"
        onclick={onRemove}
        aria-label="Remove filter: {label} {value}"
        class="relative inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full p-0 text-fg-accent transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 after:rounded-full hover:bg-accent/20 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring pointer-coarse:after:size-9">
        <X class="size-2.5" />
    </button>
</div>
