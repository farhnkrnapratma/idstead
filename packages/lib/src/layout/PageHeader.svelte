<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        eyebrow?: string;
        title: string;
        description?: string;
        align?: 'left' | 'center';
        actions?: Snippet;
        class?: string;
    }

    let {
        eyebrow = '',
        title,
        description = '',
        align = 'left',
        actions,
        class: className = ''
    }: Props = $props();
</script>

<div
    class={cn(
        'mb-8 flex flex-col gap-3 sm:mb-10',
        align === 'center' ? 'items-center text-center' : 'text-left',
        className
    )}>
    {#if eyebrow}
        <span class="text-xs font-bold tracking-wider text-accent-text uppercase select-none">
            {eyebrow}
        </span>
    {/if}

    <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl lg:text-4xl">
                {title}
            </h1>
            {#if description}
                <p class="mt-1.5 max-w-xl type-body text-text-secondary">
                    {description}
                </p>
            {/if}
        </div>

        {#if actions}
            <div class="mt-3 flex shrink-0 items-center gap-2 sm:mt-0">
                {@render actions()}
            </div>
        {/if}
    </div>
</div>
