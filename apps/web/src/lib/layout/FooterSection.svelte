<script lang="ts">
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import SpotlightSearch from '../components/SpotlightSearch.svelte';
    import ThemeSelect from '@idstead/ui/components/filter/ThemeSelect.svelte';
    import AccessibilitySelect from '@idstead/ui/components/filter/AccessibilitySelect.svelte';
    import IconButton from '@idstead/ui/components/IconButton.svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import { type SocialLink } from '#lib/author.ts';
    import BrandIcon from '#lib/components/BrandIcon.svelte';
    import FooterSiteLink from './FooterSiteLink.svelte';
    import { COOKIES_ACTION, OTHER_GROUPS, PAGE_LINKS } from '../siteNavigation';
    import { isHiddenLegalPath } from '#app/legalVisibility.ts';
    import StatusBadge from '@idstead/ui/components/StatusBadge.svelte';
    import * as publicEnv from '$app/env/public';
    import { BookOpenText } from '@lucide/svelte';
    import { copyrightLine } from '@idstead/domain/copyright.ts';

    import { page } from '$app/state';

    interface Props {
        socials?: SocialLink[];
        readingMode?: boolean;
        onToggleReadingMode?: () => void;
        width?: 'standard' | 'full' | 'reading';
        class?: string;
    }

    let {
        socials = [],
        readingMode = false,
        onToggleReadingMode,
        width = 'standard',
        class: className = ''
    }: Props = $props();

    const widthStyles = {
        standard: 'px-3 sm:px-6 md:w-[80%] lg:w-[50%]',
        reading: 'px-3 sm:px-6 md:w-[80%] lg:w-[50%]',
        full: 'w-full max-w-full px-0'
    };

    let pageAuthor = $derived((page?.data as any)?.author);

    let copyright = $derived(copyrightLine(pageAuthor?.name, new Date().getFullYear()));

    let resolvedSocials = $derived(
        Array.isArray(socials) && socials.length > 0 ? socials
        : pageAuthor?.socialLinks && pageAuthor.socialLinks.length > 0 ? pageAuthor.socialLinks
        : []
    );

    const footerGroups = $derived([
        { label: 'Pages', items: PAGE_LINKS },
        ...OTHER_GROUPS.map(group => ({
            label: group.label,
            items: [
                ...group.items.filter(item => !isHiddenLegalPath(item.href)),
                ...(group.label === 'Legal' && page.data.cookieConsent ? [COOKIES_ACTION] : [])
            ]
        }))
    ]);

    const headingId = $props.id();
</script>

<footer
    class={cn(
        'relative z-10 mx-auto mt-auto w-full max-w-full pt-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] font-sans text-xs text-fg-muted md:pb-17',
        widthStyles[width],
        className
    )}>
    <div class="rounded-md glass-card p-3.5 sm:p-6">
        <div class="flex flex-col gap-5 sm:gap-6">
            <div class="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 sm:gap-6">
                {#each footerGroups as group, index (group.label)}
                    <nav
                        aria-labelledby="{headingId}-{index}"
                        class="flex min-w-0 flex-col gap-2">
                        <h2
                            id="{headingId}-{index}"
                            class="text-xs font-semibold text-fg">
                            {group.label}
                        </h2>
                        <ul class="flex flex-col gap-2 text-xs font-normal text-fg-secondary">
                            {#each group.items as item (item.label)}
                                <li class="text-xs">
                                    <FooterSiteLink
                                        {item}
                                        class="text-xs font-normal text-fg-secondary" />
                                </li>
                            {/each}
                        </ul>
                    </nav>
                {/each}
            </div>

            {#if resolvedSocials.length > 0}
                <div class="border-t border-line-subtle pt-4 sm:pt-5">
                    <div class="flex flex-wrap gap-2">
                        {#each resolvedSocials as item (item.url + item.platform)}
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={item.platform}
                                title={item.platform}
                                use:shortcut={{ group: 'social', label: item.platform }}
                                class="relative flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-fg-muted transition-all hover:bg-surface-hover hover:text-fg-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:size-9">
                                <BrandIcon
                                    icon={item.icon}
                                    class="size-4 text-base leading-none sm:size-4.5 sm:text-lg" />
                            </a>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="flex flex-col gap-3 border-t border-line-subtle pt-4 sm:gap-4 sm:pt-5">
                <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <StatusBadge
                        host={publicEnv.PUBLIC_STATUS_PAGE_HOST}
                        code={publicEnv.PUBLIC_STATUS_PAGE_CODE} />
                    <div class="ml-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <SpotlightSearch variant="icon" />
                        {#if onToggleReadingMode}
                            <IconButton
                                ariaLabel={readingMode ? 'Exit reading mode' : 'Enter reading mode'}
                                tooltip={readingMode ? 'Exit reading mode' : 'Reading mode'}
                                keyboardShortcut={buttonKey('readingMode')}
                                shortcutLabel="Reading mode"
                                tooltipPlacement="top"
                                tooltipAlign="right"
                                size="sm"
                                onclick={onToggleReadingMode}
                                class="border-line-subtle bg-surface hover:border-accent hover:bg-surface-hover sm:h-9 sm:w-9 {(
                                    readingMode
                                ) ?
                                    'border-accent text-fg-accent'
                                :   ''}">
                                <BookOpenText class="size-4" />
                            </IconButton>
                        {/if}
                        <ThemeSelect
                            theme={themeStore.current}
                            onThemeChange={themeStore.apply}
                            dropdownDirection="up" />
                        <AccessibilitySelect dropdownDirection="up" />
                    </div>
                </div>
                <div
                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <Button
                        href="/"
                        type="ghost"
                        size="sm"
                        aria-label="Idstead home"
                        class="-ml-3 w-fit shrink-0 px-1 font-mono text-base font-semibold text-fg!">
                        Idstead
                    </Button>
                    <span class="text-xs font-medium text-fg-muted select-none">{copyright}</span>
                </div>
            </div>
        </div>
    </div>
</footer>

<style>
    @reference '@idstead/ui/styles/global.css';

    footer {
        @apply font-sans text-xs leading-normal font-normal not-italic;
    }

    h2 {
        @apply text-xs font-semibold not-italic;
    }
</style>
