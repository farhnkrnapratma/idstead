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
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' ? 'items-center text-center' : 'text-left',
        className
    )}>
    <div>
        <h1 class="type-page-title">{title}</h1>
        {#if subtitle}
            <p class="mt-2 max-w-xl text-sm text-text-secondary">{subtitle}</p>
        {/if}
    </div>

    {#if actions}
        <div class="flex shrink-0 items-center gap-2">
            {@render actions()}
        </div>
    {/if}
</div>
