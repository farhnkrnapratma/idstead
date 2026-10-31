<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { TriangleAlert, RotateCw } from '@lucide/svelte';
    import Button from './Button.svelte';
    import TechText from './TechText.svelte';
    import { cn } from '../utils/cn';

    interface Props {
        title?: string;
        description?: string;
        code?: string | number;
        size?: 'inline' | 'page';
        onRetry?: () => void;
        retryLabel?: string;
        actions?: Snippet;
        class?: string;
    }

    let {
        title = 'Something went wrong',
        description = 'We encountered an unexpected error while loading this content.',
        code,
        size = 'inline',
        onRetry,
        retryLabel = 'Try again',
        actions,
        class: className = ''
    }: Props = $props();
</script>

{#if size === 'page'}
    <div
        role="alert"
        aria-live="assertive"
        class={cn('flex flex-col items-center justify-center text-center select-none', className)}>
        {#if code !== undefined}
            <div class="h-28 w-full max-w-md font-mono text-accent sm:h-36 md:h-44">
                <TechText
                    text={String(code)}
                    label="Error {code}"
                    fontWeight={800}
                    letterSpacing={0.02} />
            </div>
        {/if}
        <h1 class="mt-4 text-2xl font-semibold tracking-tight text-balance text-fg sm:text-4xl">
            {title}
        </h1>
        {#if description}
            <p
                class="mt-6 text-lg font-medium text-pretty text-fg-secondary sm:text-xl md:text-2xl">
                {description}
            </p>
        {/if}
        {#if actions}
            <div class="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                {@render actions()}
            </div>
        {:else if onRetry}
            <div class="mt-10">
                <Button
                    type="secondary"
                    size="md"
                    onclick={onRetry}>
                    {#snippet leading()}
                        <RotateCw class="size-4" />
                    {/snippet}
                    {retryLabel}
                </Button>
            </div>
        {/if}
    </div>
{:else}
    <div
        role="alert"
        aria-live="assertive"
        class={cn(
            'flex flex-col items-center justify-center rounded-md border border-danger/30 bg-danger-subtle/10 p-8 text-center select-none',
            className
        )}>
        <div
            class="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-danger-subtle/30 text-danger">
            <TriangleAlert class="size-6" />
        </div>
        <h3 class="type-card-title">{title}</h3>
        {#if description}
            <p class="mt-1 max-w-xs type-body text-fg-secondary">{description}</p>
        {/if}

        {#if onRetry}
            <div class="mt-4">
                <Button
                    type="secondary"
                    size="sm"
                    onclick={onRetry}>
                    {#snippet leading()}
                        <RotateCw class="size-3.5" />
                    {/snippet}
                    {retryLabel}
                </Button>
            </div>
        {/if}
    </div>
{/if}
