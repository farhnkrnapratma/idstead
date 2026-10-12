<script lang="ts">
    import type { Component } from 'svelte';
    import { cn } from '../utils/cn';

    interface StatItem {
        label: string;
        value: string;
        description?: string;
        icon?: string;
        componentIcon?: Component<{ class?: string }>;
        onclick?: () => void;
    }

    interface Props {
        stats: StatItem[];
        variant?: 'default' | 'funding' | 'compact';
        columns?: 4 | 5;
        class?: string;
    }

    let { stats = [], variant = 'default', columns = 4, class: className = '' }: Props = $props();

    const columnStyles = { 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-3 lg:grid-cols-5' };
</script>

<div
    class={cn(
        'grid w-full grid-cols-2 gap-4 select-none',
        variant === 'funding' ? 'lg:grid-cols-4' : columnStyles[columns],
        className
    )}>
    {#each stats as item (item.label)}
        {#if variant === 'compact'}
            <button
                type="button"
                onclick={item.onclick}
                class="group flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-border-subtle bg-surface-card p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent-subtle/20 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-focus-ring">
                {#if item.componentIcon}
                    {@const Icon = item.componentIcon}
                    <span
                        class="flex size-10 shrink-0 items-center justify-center rounded-md border border-accent/25 bg-accent-subtle text-accent"
                        ><Icon class="size-5" /></span>
                {/if}
                <span class="min-w-0">
                    <span
                        class="block text-xl leading-none font-extrabold tracking-tight text-text-primary"
                        >{item.value}</span>
                    <span
                        class="mt-1.5 block truncate text-2xs leading-tight font-bold text-text-secondary"
                        >{item.label}</span>
                </span>
            </button>
        {:else if variant === 'funding'}
            <button
                type="button"
                onclick={item.onclick}
                class="group flex min-w-0 cursor-pointer flex-col items-start gap-1.5 rounded-md border border-border-subtle bg-surface-card p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent-subtle/20 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-focus-ring sm:p-4">
                {#if item.componentIcon}
                    {@const Icon = item.componentIcon}
                    <span
                        class="flex size-8 items-center justify-center rounded-md border border-accent/25 bg-accent-subtle text-accent"
                        ><Icon class="size-4" /></span>
                {/if}
                <span class="text-2xl font-extrabold tracking-tight text-text-primary"
                    >{item.value}</span>
                <span class="text-xs font-bold text-text-primary">{item.label}</span>
                {#if item.description}<span class="text-2xs text-text-secondary"
                        >{item.description}</span
                    >{/if}
            </button>
        {:else}
            <div
                class="flex flex-col items-center justify-center rounded-md border border-border-subtle bg-surface/50 p-4 text-center shadow-xs">
                {#if item.icon}
                    <i
                        class="bi {item.icon} mb-1 text-lg text-accent"
                        aria-hidden="true"></i>
                {/if}
                <span class="font-mono text-2xl font-extrabold tracking-tight text-text-primary"
                    >{item.value}</span>
                <span class="mt-0.5 text-xs font-bold text-text-secondary">{item.label}</span>
                {#if item.description}
                    <span class="mt-0.5 text-2xs text-text-muted">{item.description}</span>
                {/if}
            </div>
        {/if}
    {/each}
</div>
