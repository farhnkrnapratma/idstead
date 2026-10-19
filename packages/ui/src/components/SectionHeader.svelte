<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        title: string;
        subtitle?: string;
        align?: 'left' | 'center';
        actions?: Snippet;
        class?: string;
    }

    let { title, subtitle = '', align = 'left', actions, class: className = '' }: Props = $props();
</script>

<div
    class={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' ? 'items-center text-center' : 'text-left',
        className
    )}>
    <div>
        <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl lg:text-4xl">
            {title}
        </h1>
        {#if subtitle}
            <p class="mt-1 max-w-xl type-body text-text-secondary">
                {subtitle}
            </p>
        {/if}
    </div>

    {#if actions}
        <div class="mt-3 flex shrink-0 items-center gap-2 sm:mt-0">
            {@render actions()}
        </div>
    {/if}
</div>
