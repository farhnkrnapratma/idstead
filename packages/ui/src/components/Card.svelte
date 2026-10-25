<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from '../utils/cn';

    interface Props extends HTMLAttributes<HTMLDivElement> {
        variant?: 'default' | 'glass' | 'bordered' | 'solid';
        density?: 'padded' | 'compact' | 'none';
        interactive?: boolean;
        header?: Snippet;
        footer?: Snippet;
        children?: Snippet;
        class?: string;
    }

    let {
        variant = 'default',
        density = 'padded',
        interactive = false,
        header,
        footer,
        children,
        class: className = '',
        ...restProps
    }: Props = $props();

    const variantStyles = {
        default: 'glass-card',
        glass: 'glass-card',
        bordered: 'bg-transparent border border-line-subtle/50',
        solid: 'border-0 dark:border dark:border-fg/5 bg-surface text-fg shadow-sm'
    };

    const densityStyles = { padded: 'p-3.5 sm:p-6', compact: 'p-2.5 sm:p-4', none: 'p-0' };

    const interactiveStyles = $derived(
        interactive ?
            'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'
        :   ''
    );
</script>

{#if interactive}
    <div
        role="button"
        tabindex={0}
        class={cn(
            'overflow-hidden rounded-md text-left transition-colors duration-300',
            variantStyles[variant],
            densityStyles[density],
            interactiveStyles,
            className
        )}
        {...restProps}>
        {#if header}
            <div class="mb-4 border-b border-line-subtle pb-3">
                {@render header()}
            </div>
        {/if}

        {@render children?.()}

        {#if footer}
            <div class="mt-4 border-t border-line-subtle pt-3">
                {@render footer()}
            </div>
        {/if}
    </div>
{:else}
    <div
        class={cn(
            'overflow-hidden rounded-md transition-colors duration-300',
            variantStyles[variant],
            densityStyles[density],
            className
        )}
        {...restProps}>
        {#if header}
            <div class="mb-4 border-b border-line-subtle pb-3">
                {@render header()}
            </div>
        {/if}

        {@render children?.()}

        {#if footer}
            <div class="mt-4 border-t border-line-subtle pt-3">
                {@render footer()}
            </div>
        {/if}
    </div>
{/if}
