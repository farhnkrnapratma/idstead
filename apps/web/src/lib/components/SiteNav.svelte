<script lang="ts">
    import ThemeSelect from '@idstead/ui/components/filter/ThemeSelect.svelte';
    import AccessibilitySelect from '@idstead/ui/components/filter/AccessibilitySelect.svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import IconButton from '@idstead/ui/components/IconButton.svelte';
    import NavMenu from '@idstead/ui/components/NavMenu.svelte';
    import PageContainer from '@idstead/ui/layout/PageContainer.svelte';
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import { readingModeStore } from '@idstead/ui/stores/readingModeStore.svelte.ts';
    import { BookOpenText } from '@lucide/svelte';
    import { page } from '$app/state';
    import type { Project } from '@idstead/domain/types.ts';
    import { isHiddenLegalPath } from '#app/legalVisibility.ts';
    import { OTHER_GROUPS, PAGE_LINKS } from '#app/siteNavigation.ts';
    import SpotlightSearch from './SpotlightSearch.svelte';

    interface Props {
        projects?: Project[];
        readingMode?: boolean;
    }

    let { projects = [], readingMode = false }: Props = $props();

    const pathname = $derived(page.url.pathname);

    function isCurrent(href: string) {
        return href === '/' ?
                pathname === '/'
            :   pathname === href || pathname.startsWith(`${href}/`);
    }

    const otherGroups = $derived(
        OTHER_GROUPS.map(group => ({
            ...group,
            items: group.items
                .filter(item => !isHiddenLegalPath(item.href))
                .map(item => ({
                    label: item.label,
                    href: item.href,
                    combo: item.combo,
                    current: isCurrent(item.href)
                }))
        }))
    );
    const otherActive = $derived(otherGroups.some(group => group.items.some(item => item.current)));
    const menuGroups = $derived([
        {
            label: 'Pages',
            items: PAGE_LINKS.map(link => ({
                label: link.label,
                href: link.href,
                combo: link.combo,
                current: isCurrent(link.href)
            }))
        },
        ...otherGroups
    ]);
</script>

<header class="sticky top-0 z-40 glass-card font-sans dark:border-0!">
    <PageContainer
        width="full"
        class="flex h-14 items-center gap-2 sm:gap-4">
        <Button
            href="/"
            type="ghost"
            size="sm"
            aria-label="Idstead home"
            class="shrink-0 px-1 font-mono text-base font-semibold text-fg!">
            Idstead
        </Button>
        <nav
            aria-label="Main"
            class="hidden items-center gap-0.5 md:flex">
            {#each PAGE_LINKS as link (link.href)}
                {@const current = isCurrent(link.href)}
                <Button
                    href={link.href}
                    type="ghost"
                    size="sm"
                    aria-current={current ? 'page' : undefined}
                    keyboardShortcut={link.combo}
                    shortcutLabel={link.label}
                    class={cn(
                        'px-2 text-sm font-medium',
                        current ? 'text-fg!' : 'text-fg-muted! hover:text-fg!'
                    )}>
                    {link.label}
                </Button>
            {/each}
            <NavMenu
                label="Other"
                groups={otherGroups}
                active={otherActive}
                shortcut={buttonKey('navMenu')} />
        </nav>
        <NavMenu
            label="Menu"
            groups={menuGroups}
            shortcut={buttonKey('navMenu')}
            class="md:hidden" />
        <div class="ml-auto flex items-center gap-1.5 sm:gap-2">
            <SpotlightSearch {projects} />
            {#if readingMode}
                <IconButton
                    ariaLabel="Enter reading mode"
                    tooltip="Reading mode"
                    keyboardShortcut={buttonKey('readingMode')}
                    shortcutLabel="Reading mode"
                    tooltipPlacement="bottom"
                    tooltipAlign="right"
                    size="sm"
                    onclick={readingModeStore.toggle}
                    class="border-line-subtle bg-surface backdrop-blur-none hover:border-accent hover:bg-surface-hover sm:h-9 sm:w-9">
                    <BookOpenText class="size-4" />
                </IconButton>
            {/if}
            <ThemeSelect
                theme={themeStore.current}
                onThemeChange={themeStore.apply} />
            <AccessibilitySelect />
        </div>
    </PageContainer>
</header>
