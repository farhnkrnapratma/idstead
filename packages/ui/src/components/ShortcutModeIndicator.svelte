<script lang="ts">
    import { fade } from 'svelte/transition';
    import { KeySquare } from '@lucide/svelte';
    import { CHORD_GROUPS, CATALOG_KEY, ARM_TIMEOUT_MS } from '../shortcuts.ts';
    import { shortcutStore } from '../stores/shortcutStore.svelte';
    import ShortcutBadge from './ShortcutBadge.svelte';

    const pendingLabel = $derived(
        shortcutStore.pendingGroup ?
            (CHORD_GROUPS[shortcutStore.pendingGroup]?.label ?? shortcutStore.pendingGroup)
        :   ''
    );
</script>

{#if shortcutStore.leaderArmed}
    <div
        transition:fade={{ duration: 120 }}
        role="status"
        aria-live="polite"
        class="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-200 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-md glass-overlay border border-accent/40 font-sans text-2xs text-fg shadow-lg">
        <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-3 py-2">
            <span class="flex items-center gap-1.5 font-semibold">
                <KeySquare
                    class="size-3.5 shrink-0 text-fg-accent"
                    aria-hidden="true" />
                {pendingLabel || 'Shortcut mode'}
            </span>
            <span class="text-fg-secondary">
                {pendingLabel ?
                    'Press the key shown on a badge.'
                :   'Press the key shown on a button.'}
            </span>
            <span class="flex items-center gap-1 text-fg-muted">
                <ShortcutBadge combo="Esc" />
                to cancel
            </span>
            {#if !pendingLabel}
                <span class="flex items-center gap-1 text-fg-muted">
                    <ShortcutBadge combo={CATALOG_KEY} />
                    for all shortcuts
                </span>
            {/if}
        </div>
        {#key shortcutStore.armedAt}
            <div
                class="countdown h-0.5 w-full origin-left bg-accent"
                style:animation-duration="{ARM_TIMEOUT_MS}ms">
            </div>
        {/key}
    </div>
{/if}

<style>
    .countdown {
        animation-name: shortcut-countdown;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
    }

    @keyframes shortcut-countdown {
        from {
            transform: scaleX(1);
        }
        to {
            transform: scaleX(0);
        }
    }
</style>
