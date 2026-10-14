<script lang="ts">
    import type { HTMLInputAttributes } from 'svelte/elements';
    import { Square, SquareCheck } from '@lucide/svelte';
    import { cn } from '../utils/cn';

    interface Props extends Omit<HTMLInputAttributes, 'type'> {
        checked?: boolean;
        label?: string;
        description?: string;
    }

    let {
        checked = $bindable(false),
        label = '',
        description = '',
        id,
        disabled = false,
        class: className = '',
        ...restProps
    }: Props = $props();
</script>

<label
    class={cn(
        'group inline-flex cursor-pointer items-start gap-2.5 rounded-sm select-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring pointer-coarse:min-h-11 pointer-coarse:items-center',
        disabled ? 'cursor-not-allowed opacity-50' : '',
        className
    )}>
    <input
        type="checkbox"
        {id}
        {disabled}
        bind:checked
        class="sr-only"
        {...restProps} />
    <span
        class="flex size-4 h-5 shrink-0 items-center justify-center text-text-muted transition-colors group-hover:text-text-primary"
        aria-hidden="true">
        {#if checked}
            <SquareCheck class="size-4 text-accent-text" />
        {:else}
            <Square
                class="size-4 text-text-muted transition-colors group-hover:text-text-secondary" />
        {/if}
    </span>
    {#if label || description}
        <div class="flex flex-col">
            {#if label}
                <span
                    class="flex min-h-5 items-center text-sm leading-none font-semibold text-text-primary">
                    {label}
                </span>
            {/if}
            {#if description}
                <span class="mt-0.5 text-xs text-text-muted">{description}</span>
            {/if}
        </div>
    {/if}
</label>
