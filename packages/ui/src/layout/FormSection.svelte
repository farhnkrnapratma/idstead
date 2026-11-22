<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        title?: string;
        description?: string;
        titleClass?: string;
        titleTag?: 'h1' | 'h2';
        action?: string;
        method?: 'POST' | 'GET' | 'post' | 'get' | 'dialog' | 'DIALOG';
        onsubmit?: (e: SubmitEvent) => void;
        class?: string;
        bare?: boolean;
        children?: Snippet;
        headerActions?: Snippet;
        actions?: Snippet;
    }

    let {
        title = '',
        description = '',
        titleClass = 'type-section-title',
        titleTag = 'h2',
        action = '',
        method = 'POST',
        onsubmit,
        class: className = '',
        bare = false,
        children,
        headerActions,
        actions
    }: Props = $props();
    const card = 'rounded-md glass-card p-3.5 sm:p-6';
    const pageLevel = $derived(titleTag === 'h1' && !bare);

    function handleSubmit(e: SubmitEvent) {
        if (onsubmit) {
            e.preventDefault();
            onsubmit(e);
        }
    }
</script>

<form
    {action}
    {method}
    onsubmit={handleSubmit}
    novalidate
    class={cn('flex flex-col gap-4 sm:gap-6', !pageLevel && !bare && card, !pageLevel && className)}
    autocomplete="off">
    {#if title || description || headerActions}
        <div class="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
            <div class="min-w-0 flex-1 select-none">
                {#if title}
                    <svelte:element
                        this={titleTag}
                        class={titleClass}>
                        {title}
                    </svelte:element>
                {/if}
                {#if description}
                    <p class="mt-1 type-body text-fg-secondary">{description}</p>
                {/if}
            </div>
            {#if headerActions}
                <div class="flex shrink-0 items-center">
                    {@render headerActions()}
                </div>
            {/if}
        </div>
    {/if}

    {#if pageLevel}
        <div class={cn('flex flex-col gap-4 sm:gap-6', card, className)}>
            {@render children?.()}

            {@render actions?.()}
        </div>
    {:else}
        {@render children?.()}

        {@render actions?.()}
    {/if}
</form>
