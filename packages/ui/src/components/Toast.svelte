<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { fade } from 'svelte/transition';
    import { CircleAlert, TriangleAlert, Info } from '@lucide/svelte';
    import { toastStore } from '../stores/toastStore.svelte';
    import { cn } from '../utils/cn';

    interface Props {
        class?: string;
    }

    let { class: className = '' }: Props = $props();
</script>

{#if toastStore.visible}
    <div
        transition:fade={{ duration: 150 }}
        role="status"
        aria-live="polite"
        class={cn(
            'fixed bottom-6 left-1/2 z-200 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-md glass-overlay px-3 py-2 text-2xs leading-snug font-medium text-fg sm:text-xs sm:font-semibold',
            className
        )}>
        {#if toastStore.type === 'error'}
            <CircleAlert class="size-4 shrink-0 text-danger" />
        {:else if toastStore.type === 'warning'}
            <TriangleAlert class="size-4 shrink-0 text-warning" />
        {:else}
            <Info class="size-4 shrink-0 text-fg-accent" />
        {/if}
        {toastStore.message}
    </div>
{/if}
