<script lang="ts">
    import ThemeSelect from '@idstead/ui/components/filter/ThemeSelect.svelte';
    import AccessibilitySelect from '@idstead/ui/components/filter/AccessibilitySelect.svelte';
    import IconButton from '@idstead/ui/components/IconButton.svelte';
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import { BookOpenText, House } from '@lucide/svelte';
    import { page } from '$app/state';
    import PageContainer from '@idstead/ui/layout/PageContainer.svelte';
    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import type { Project } from '@idstead/domain/types.ts';
    import SpotlightSearch from './SpotlightSearch.svelte';

    interface Props {
        projects?: Project[];
        onToggleReadingMode?: () => void;
    }

    let { projects = [], onToggleReadingMode }: Props = $props();
</script>

<PageContainer
    width="standard"
    class="relative z-40 pt-6 font-sans sm:pt-8">
    <div
        class="flex items-center justify-between gap-3"
        role="toolbar"
        aria-label="Site tools">
        <div class="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {#if page.url.pathname !== '/'}
                <IconButton
                    href="/"
                    ariaLabel="Home"
                    tooltip="Home"
                    keyboardShortcut={buttonKey('back')}
                    shortcutLabel="Home"
                    tooltipPlacement="bottom"
                    tooltipAlign="left"
                    size="sm"
                    class="shrink-0 border-line-subtle bg-surface backdrop-blur-none hover:border-accent hover:bg-surface-hover sm:h-9 sm:w-9">
                    <House class="size-4" />
                </IconButton>
            {/if}
            <SpotlightSearch
                {projects}
                variant="responsive" />
        </div>
        <div class="flex items-center gap-1.5 sm:gap-2">
            {#if onToggleReadingMode}
                <IconButton
                    ariaLabel="Enter reading mode"
                    tooltip="Reading mode"
                    keyboardShortcut={buttonKey('readingMode')}
                    shortcutLabel="Reading mode"
                    tooltipPlacement="bottom"
                    tooltipAlign="right"
                    size="sm"
                    onclick={onToggleReadingMode}
                    class="border-line-subtle bg-surface backdrop-blur-none hover:border-accent hover:bg-surface-hover sm:h-9 sm:w-9">
                    <BookOpenText class="size-4" />
                </IconButton>
            {/if}
            <ThemeSelect
                theme={themeStore.current}
                onThemeChange={themeStore.apply} />
            <AccessibilitySelect />
        </div>
    </div>
</PageContainer>
