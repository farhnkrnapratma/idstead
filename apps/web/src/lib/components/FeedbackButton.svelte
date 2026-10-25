<script lang="ts">
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import { fade } from 'svelte/transition';
    import { goto } from '$app/navigation';
    import { MessageSquareWarning } from '@lucide/svelte';
    import IconButton from '@idstead/ui/components/IconButton.svelte';

    interface Props {
        show?: boolean;
        class?: string;
    }

    let { show = true, class: className = '' }: Props = $props();
</script>

{#if show}
    <div
        transition:fade={{ duration: 150 }}
        class="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 z-40 md:bottom-6 md:left-6 {className}">
        <IconButton
            variant="floating"
            size="sm"
            ariaLabel="Report an issue or give feedback"
            tooltip="Feedback"
            tooltipPlacement="top"
            tooltipAlign="left"
            keyboardShortcut={buttonKey('feedback')}
            shortcutLabel="Send feedback"
            onclick={() => goto('/feedback')}>
            <MessageSquareWarning class="size-4 shrink-0" />
        </IconButton>
    </div>
{/if}
