<script lang="ts">
    import { SkipForward } from '@lucide/svelte';
    import { cn } from '../utils/cn';
    import Button from './Button.svelte';
    import { buttonKey } from '#lib/shortcuts.ts';

    interface Props {
        targetId?: string;
        label?: string;
        class?: string;
    }

    let {
        targetId = 'main',
        label = 'Skip to main content',
        class: className = ''
    }: Props = $props();

    let isFocused = $state(false);
    let isVisible = $derived(isFocused);

    function handleActivate() {
        isFocused = false;
        const target = document.getElementById(targetId);
        if (target) {
            target.tabIndex = -1;
            target.focus({ preventScroll: true });
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (!isFocused) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            isFocused = false;
            return;
        }
        if (e.key === 'Tab') {
            isFocused = false;
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            handleActivate();
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isFocused}
    <div
        class="fixed inset-0 z-90 bg-overlay/60 backdrop-blur-xs transition-opacity duration-200"
        role="presentation"
        aria-hidden="true"
        onclick={() => {
            isFocused = false;
        }}>
    </div>
{/if}

<div
    class={cn(
        'fixed top-3 left-1/2 z-100 -translate-x-1/2 transition-all duration-200 ease-out select-none',
        isVisible ?
            'pointer-events-auto translate-y-0 scale-100 opacity-100'
        :   'pointer-events-none -translate-y-4 scale-95 opacity-0',
        className
    )}>
    <Button
        type="primary"
        size="sm"
        {label}
        keyboardShortcut={isFocused ? buttonKey('skipLink') : undefined}
        onfocus={() => (isFocused = true)}
        onblur={() => (isFocused = false)}
        onclick={handleActivate}
        class="font-sans font-semibold shadow-xl!">
        {#snippet trailing()}
            <SkipForward class="size-3.5 shrink-0" />
        {/snippet}
    </Button>
</div>
