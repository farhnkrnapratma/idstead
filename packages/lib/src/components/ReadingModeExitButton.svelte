<script lang="ts">
    import { fade } from 'svelte/transition';
    import { BookOpenText } from '@lucide/svelte';
    import { buttonKey } from '#lib/shortcuts.ts';
    import { readingModeStore } from '../stores/readingModeStore.svelte';
    import IconButton from './IconButton.svelte';
</script>

{#if readingModeStore.active}
    <div
        transition:fade={{ duration: 150 }}
        class="fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 md:right-6 md:bottom-6 lg:right-[calc(25%+(2.5vw-0.75rem)/2)] lg:translate-x-1/2">
        <IconButton
            variant="floating-accent"
            size="sm"
            ariaLabel="Exit reading mode"
            tooltipPlacement="top"
            tooltipAlign="right"
            keyboardShortcut={buttonKey('readingMode')}
            onclick={readingModeStore.toggle}>
            <BookOpenText class="size-4 shrink-0" />
        </IconButton>
    </div>
{/if}
