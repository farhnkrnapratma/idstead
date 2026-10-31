<script lang="ts">
    import { cn } from '../utils/cn';

    interface Props {
        label?: string;
        size?: 'sm' | 'md' | 'lg';
        variant?: 'skeleton' | 'spinner' | 'post-card' | 'post-editor';
        count?: number;
        class?: string;
    }

    let {
        label = 'Loading content...',
        size = 'md',
        variant = 'skeleton',
        count = 3,
        class: className = ''
    }: Props = $props();

    const sizeStyles = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-8 w-8 border-3' };
</script>

{#if variant === 'post-card'}
    <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        class={cn('w-full space-y-6 select-none', className)}>
        <div class="flex animate-pulse flex-wrap items-center justify-between gap-4">
            <div class="space-y-1.5">
                <div class="h-7 w-28 rounded-md bg-surface-hover"></div>
                <div class="h-3 w-48 rounded bg-line-subtle/50"></div>
            </div>
            <div class="h-9 w-28 rounded-md bg-surface-hover"></div>
        </div>

        <div class="animate-pulse space-y-3 rounded-md glass-card p-4 shadow-sm">
            <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div class="h-8 w-full rounded-md bg-surface-hover/80 sm:w-60"></div>
                <div class="h-4 w-28 rounded bg-line-subtle/50"></div>
            </div>
            <div
                class="flex flex-col gap-2.5 border-t border-line-subtle pt-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div class="w-full sm:w-auto">
                    <div class="h-9 w-full rounded-md bg-surface-hover/70 sm:w-28"></div>
                </div>
                <div class="w-full sm:flex sm:w-auto sm:items-center sm:justify-end">
                    <div class="h-9 w-full rounded-md bg-surface-hover/70 sm:w-32"></div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 items-start gap-4">
            {#each Array.from({ length: count }, (_, i) => i) as itemIndex (itemIndex)}
                <div
                    class="flex animate-pulse flex-col overflow-hidden rounded-md glass-card shadow-sm">
                    <div
                        class="flex aspect-2/1 w-full items-center justify-center border-b border-line-subtle bg-surface-hover/60">
                        <div class="size-8 rounded-md bg-surface-hover/80"></div>
                    </div>

                    <div class="flex flex-col gap-3 p-4">
                        <div class="flex items-center gap-2">
                            <div class="h-4 w-16 rounded-md bg-accent/15"></div>
                            <div class="h-3 w-20 rounded bg-line-subtle/50"></div>
                            <div class="h-3 w-14 rounded bg-line-subtle/40"></div>
                            <div class="h-3 w-10 rounded bg-line-subtle/40"></div>
                        </div>

                        <div class="h-5 w-3/4 rounded bg-surface-hover"></div>

                        <div class="space-y-1.5">
                            <div class="h-3 w-full rounded bg-line-subtle/50"></div>
                            <div class="h-3 w-4/5 rounded bg-line-subtle/35"></div>
                        </div>

                        <div class="flex items-center gap-1.5 pt-1">
                            <div class="h-5 w-14 rounded-md bg-surface-hover/80"></div>
                            <div class="h-5 w-16 rounded-md bg-surface-hover/80"></div>
                            <div class="h-5 w-12 rounded-md bg-surface-hover/80"></div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>

        {#if label}
            <span class="sr-only">{label}</span>
        {/if}
    </div>
{:else if variant === 'post-editor'}
    <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        class={cn('w-full space-y-4 select-none', className)}>
        <div
            class="animate-pulse rounded-md border border-line-subtle bg-surface p-6 text-left shadow-sm">
            <div class="mb-6 h-5 w-36 rounded bg-surface-hover"></div>
            <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div class="flex flex-col gap-2.5 lg:col-span-5">
                    <div class="h-3.5 w-24 rounded bg-line-subtle/50"></div>
                    <div
                        class="flex aspect-2/1 w-full items-center justify-center rounded-md border border-line-subtle bg-surface-hover/60">
                        <div class="size-8 rounded-md bg-surface-hover/80"></div>
                    </div>
                    <div class="h-8 w-full rounded-md bg-surface-hover/40"></div>
                </div>

                <div class="flex flex-col gap-4 lg:col-span-7">
                    <div class="space-y-1.5">
                        <div class="h-3 w-16 rounded bg-line-subtle/50"></div>
                        <div class="h-9 w-full rounded-md bg-surface-hover/60"></div>
                    </div>

                    <div class="space-y-1.5">
                        <div class="h-3 w-12 rounded bg-line-subtle/50"></div>
                        <div class="h-9 w-full rounded-md bg-surface-hover/60"></div>
                    </div>

                    <div class="space-y-1.5">
                        <div class="h-3 w-20 rounded bg-line-subtle/50"></div>
                        <div class="h-16 w-full rounded-md bg-surface-hover/60"></div>
                    </div>

                    <div class="space-y-1.5">
                        <div class="h-3 w-14 rounded bg-line-subtle/50"></div>
                        <div class="h-9 w-full rounded-md bg-surface-hover/60"></div>
                    </div>
                </div>
            </div>
        </div>

        <div
            class="animate-pulse overflow-hidden rounded-md border border-line-subtle bg-surface shadow-sm">
            <div
                class="flex h-13 items-center justify-between border-b border-line-subtle bg-surface px-4">
                <div class="flex gap-2">
                    <div class="h-7 w-16 rounded-md bg-surface-hover"></div>
                    <div class="h-7 w-18 rounded-md bg-surface-hover/50"></div>
                </div>
                <div class="hidden gap-2 sm:flex">
                    <div class="h-7 w-20 rounded-md bg-surface-hover/40"></div>
                    <div class="h-7 w-12 rounded-md bg-surface-hover/40"></div>
                    <div class="h-7 w-24 rounded-md bg-surface-hover/40"></div>
                </div>
            </div>

            <div class="min-h-75 space-y-3 bg-canvas p-6">
                <div class="h-4 w-3/4 rounded bg-surface-hover/40"></div>
                <div class="h-4 w-1/2 rounded bg-surface-hover/30"></div>
                <div class="h-4 w-5/6 rounded bg-surface-hover/40"></div>
                <div class="h-4 w-2/3 rounded bg-surface-hover/30"></div>
                <div class="h-4 w-4/5 rounded bg-surface-hover/40"></div>
            </div>

            <div class="flex h-10 items-center gap-2 border-t border-line-subtle bg-surface px-4">
                <div class="size-5 rounded bg-surface-hover/50"></div>
                <div class="size-5 rounded bg-surface-hover/50"></div>
                <div class="size-5 rounded bg-surface-hover/50"></div>
                <div class="size-5 rounded bg-surface-hover/50"></div>
            </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
            <div class="h-9 w-28 rounded-md bg-surface-hover/60"></div>
            <div class="h-9 w-32 rounded-md bg-accent/30"></div>
        </div>

        {#if label}
            <span class="sr-only">{label}</span>
        {/if}
    </div>
{:else if variant === 'skeleton'}
    <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        class={cn('w-full space-y-3 select-none', className)}>
        {#each Array.from({ length: count }, (_, i) => i) as itemIndex (itemIndex)}
            <div class="animate-pulse rounded-md glass-card p-4 shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="size-8 shrink-0 rounded-md bg-surface-hover"></div>
                    <div class="flex-1 space-y-2">
                        <div class="h-3.5 w-2/5 rounded bg-surface-hover"></div>
                        <div class="h-2.5 w-4/5 rounded bg-line-subtle/50"></div>
                    </div>
                </div>
            </div>
        {/each}
        {#if label}
            <span class="sr-only">{label}</span>
        {/if}
    </div>
{:else}
    <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        class={cn(
            'flex flex-col items-center justify-center gap-3 p-8 text-center select-none',
            className
        )}>
        <div
            class={cn(
                'animate-spin rounded-md border-line-subtle border-t-accent',
                sizeStyles[size]
            )}>
        </div>
        {#if label}
            <span class="text-xs font-medium text-fg-muted">{label}</span>
        {/if}
    </div>
{/if}
