<script lang="ts">
    import { buttonKey } from '../shortcuts.ts';
    import { fade } from 'svelte/transition';
    import { MoveUp } from '@lucide/svelte';
    import { scrollToTop } from '../utils/scroll.ts';
    import IconButton from './IconButton.svelte';

    interface Props {
        show?: boolean;
        class?: string;
        onClick?: () => void;
    }

    let { show = true, class: className = '', onClick }: Props = $props();
</script>

{#if show}
    <div
        transition:fade={{ duration: 150 }}
        class="fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 md:right-6 md:bottom-6 {className}">
        <IconButton
            variant="floating"
            size="sm"
            ariaLabel="Scroll to top"
            showTooltip={false}
            keyboardShortcut={buttonKey('scrollTop')}
            class="gap-2 md:w-auto md:px-3"
            onclick={onClick || (() => scrollToTop('smooth'))}>
            <MoveUp class="size-4 shrink-0" />
            <span class="hidden whitespace-nowrap md:inline">Scroll to top</span>
        </IconButton>
    </div>
{/if}
