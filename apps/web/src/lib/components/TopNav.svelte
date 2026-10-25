<script lang="ts">
    import SpotlightSearch from './SpotlightSearch.svelte';
    import ThemeSelect from '@idstead/ui/components/filter/ThemeSelect.svelte';
    import AccessibilitySelect from '@idstead/ui/components/filter/AccessibilitySelect.svelte';
    import IconButton from '@idstead/ui/components/IconButton.svelte';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import { ArrowLeft, BookOpenText } from '@lucide/svelte';
    import type { Project } from '@idstead/domain/types.ts';

    interface Props {
        ariaLabel: string;
        backHref: string;
        backLabel: string;
        projects?: Project[];
        readingMode?: boolean;
        onToggleReadingMode?: () => void;
    }

    let {
        ariaLabel,
        backHref,
        backLabel,
        projects = [],
        readingMode = false,
        onToggleReadingMode
    }: Props = $props();
</script>

<nav
    class="fixed inset-x-2 top-2 z-60 flex h-12 items-center justify-between rounded-md glass-card border border-line-subtle/30 px-3 font-sans shadow-2xs sm:inset-x-3 sm:top-3 sm:h-14 sm:px-5"
    aria-label={ariaLabel}>
    <a
        href={backHref}
        use:shortcut={{ combo: buttonKey('back'), label: backLabel }}
        class="relative inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-line-subtle/50 bg-surface px-2.5 text-xs font-semibold whitespace-nowrap text-fg shadow-2xs transition-colors hover:bg-surface-hover hover:text-fg-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:h-9 sm:px-4">
        <ArrowLeft class="size-3.5 shrink-0" />
        {backLabel}
    </a>

    <div class="flex items-center gap-1 sm:gap-1.5">
        {#if !readingMode}
            <SpotlightSearch {projects} />
        {/if}
        {#if onToggleReadingMode}
            <IconButton
                ariaLabel={readingMode ? 'Exit reading mode' : 'Enter reading mode'}
                tooltip={readingMode ? 'Exit reading mode' : 'Reading mode'}
                keyboardShortcut={buttonKey('readingMode')}
                shortcutLabel="Reading mode"
                tooltipPlacement="bottom"
                tooltipAlign="right"
                size="sm"
                onclick={onToggleReadingMode}
                class="border-line-subtle bg-surface backdrop-blur-none hover:border-accent hover:bg-surface-hover sm:h-9 sm:w-9 {(
                    readingMode
                ) ?
                    'border-accent text-fg-accent'
                :   ''}">
                <BookOpenText class="size-4" />
            </IconButton>
        {/if}
        <ThemeSelect
            theme={themeStore.current}
            onThemeChange={themeStore.apply} />
        {#if !readingMode}
            <AccessibilitySelect />
        {/if}
    </div>
</nav>
