<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        title?: string;
        description?: string;
        variant?: 'default' | 'highlight' | 'glass';
        class?: string;
        actions?: Snippet;
        children?: Snippet;
    }

    let {
        title = '',
        description = '',
        variant = 'default',
        class: className = '',
        actions,
        children
    }: Props = $props();

    const variantStyles = {
        default: 'bg-surface/50 border border-border-subtle',
        highlight: 'bg-accent-subtle/20 border border-accent/30',
        glass: 'glass-card'
    };
</script>

<div
    class={cn(
        'flex flex-col gap-3 rounded-md p-5 shadow-xs transition-colors duration-300 sm:p-6',
        variantStyles[variant],
        className
    )}>
    {#if title || description}
        <div class="flex flex-col gap-1">
            {#if title}
                <h3 class="text-sm font-bold text-text-primary">{title}</h3>
            {/if}
            {#if description}
                <p class="text-xs leading-relaxed text-text-secondary">{description}</p>
            {/if}
        </div>
    {/if}

    {#if children}
        {@render children()}
    {/if}

    {#if actions}
        <div class="mt-2 flex items-center justify-end gap-2 border-t border-border-subtle/40 pt-3">
            {@render actions()}
        </div>
    {/if}
</div>
