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
            showTooltip={false}
            keyboardShortcut={buttonKey('feedback')}
            shortcutLabel="Send feedback"
            class="gap-2 md:w-auto md:px-3"
            onclick={() => goto('/feedback')}>
            <MessageSquareWarning class="size-4 shrink-0" />
            <span class="hidden whitespace-nowrap md:inline">Feedback</span>
        </IconButton>
    </div>
{/if}
