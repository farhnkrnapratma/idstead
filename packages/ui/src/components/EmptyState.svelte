<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Component, Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        icon: Component<{ class?: string }>;
        iconClass?: string;
        title: string;
        description: string;
        class?: string;
        actions?: Snippet;
    }

    let {
        icon: Icon,
        iconClass = '',
        title,
        description,
        class: className = '',
        actions
    }: Props = $props();
</script>

<div
    data-empty-state
    class={cn('flex flex-col items-center justify-center p-8 text-center select-none', className)}>
    <div class="mb-3 flex items-center justify-center text-fg-muted">
        <Icon class={cn('size-7', iconClass)} />
    </div>
    <h3 class="type-card-title">{title}</h3>
    <p class="mt-1 max-w-xs type-body text-fg-muted">{description}</p>

    {#if actions}
        <div class="mt-4 flex items-center gap-2">
            {@render actions()}
        </div>
    {/if}
</div>
