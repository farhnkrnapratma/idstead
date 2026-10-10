<script lang="ts">
    import { fade } from 'svelte/transition';
    import { AlertCircle, AlertTriangle, Info } from '@lucide/svelte';
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
            'fixed bottom-6 left-1/2 z-200 flex -translate-x-1/2 items-center gap-2 rounded-md glass-overlay px-3 py-2 text-xs font-semibold text-text-primary',
            className
        )}>
        {#if toastStore.type === 'error'}
            <AlertCircle class="size-4 text-danger" />
        {:else if toastStore.type === 'warning'}
            <AlertTriangle class="size-4 text-warning" />
        {:else}
            <Info class="size-4 text-security" />
        {/if}
        {toastStore.message}
    </div>
{/if}
