<script lang="ts">
    import type { Component } from 'svelte';
    import { ChevronRight } from '@lucide/svelte';
    import { cn } from '../utils/cn';

    interface StatItem {
        label: string;
        value: string;
        description?: string;
        ratio?: number;
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
            <svelte:element
                this={item.onclick ? 'button' : 'div'}
                type={item.onclick ? 'button' : undefined}
                role={item.onclick ? undefined : 'group'}
                onclick={item.onclick}
                class={cn(
                    'group flex h-full min-w-0 flex-col gap-3 rounded-md border border-border-subtle bg-surface-card p-4 text-left transition-colors',
                    item.onclick
                        && 'cursor-pointer hover:border-accent/50 hover:bg-accent-subtle/20 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-focus-ring'
                )}>
                <span class="flex min-w-0 items-center gap-2.5">
                    {#if item.componentIcon}
                        {@const Icon = item.componentIcon}
                        <span
                            class="flex size-8 shrink-0 items-center justify-center rounded-md border border-accent/25 bg-accent-subtle text-accent-text"
                            ><Icon class="size-4" /></span>
                    {/if}
                    <span class="min-w-0 truncate text-xs font-bold text-text-secondary"
                        >{item.label}</span>
                    {#if item.onclick}
                        <ChevronRight
                            class="ml-auto size-4 shrink-0 text-text-muted transition-[color,translate] group-hover:text-accent-text motion-safe:group-hover:translate-x-0.5"
                            aria-hidden="true" />
                    {/if}
                </span>
                <span class="flex min-w-0 flex-col gap-1.5">
                    <span
                        class="block text-3xl leading-none font-extrabold tracking-tight text-text-primary tabular-nums"
                        >{item.value}</span>
                    <span class="block min-h-lh truncate text-xs text-text-muted"
                        >{item.description ?? ''}</span>
                </span>
                {#if item.ratio !== undefined}
                    <span
                        class="mt-auto block h-1 w-full overflow-hidden rounded-full bg-border-subtle"
                        aria-hidden="true">
                        <span
                            class="block h-full rounded-full bg-accent"
                            style="width: {Math.min(1, Math.max(0, item.ratio)) * 100}%"></span>
                    </span>
                {/if}
            </svelte:element>
        {:else if variant === 'funding'}
            <button
                type="button"
                onclick={item.onclick}
                class="group flex min-w-0 cursor-pointer flex-col items-start gap-1.5 rounded-md border border-border-subtle bg-surface-card p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent-subtle/20 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-focus-ring sm:p-4">
                {#if item.componentIcon}
                    {@const Icon = item.componentIcon}
                    <span
                        class="flex size-8 items-center justify-center rounded-md border border-accent/25 bg-accent-subtle text-accent-text"
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
                        class="bi {item.icon} mb-1 text-lg text-accent-text"
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
