<script lang="ts">
    import { buttonKey } from '@fkp/ui/shortcuts.ts';
    import { fade } from 'svelte/transition';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { MessageSquareWarning } from '@lucide/svelte';
    import IconButton from '@fkp/ui/components/IconButton.svelte';

    interface Props {
        show?: boolean;
        hasBottomNav?: boolean;
        class?: string;
    }

    let { show = true, hasBottomNav, class: className = '' }: Props = $props();

    const isMainPage = $derived(
        hasBottomNav !== undefined ? hasBottomNav : page.url.pathname === '/'
    );
</script>

{#if show}
    <div
        transition:fade={{ duration: 150 }}
        class="fixed left-3 z-40 md:bottom-6 md:left-6 {isMainPage ?
            'bottom-[calc(4.25rem+env(safe-area-inset-bottom))]'
        :   'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'} {className}">
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
