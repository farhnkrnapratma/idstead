<script lang="ts">
    import { buttonKey, sectionCommandKey } from '@idstead/ui/shortcuts.ts';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import SpotlightSearch from '../components/SpotlightSearch.svelte';
    import ThemeSelect from '@idstead/ui/components/filter/ThemeSelect.svelte';
    import ContentFontSelect from '@idstead/ui/components/filter/ContentFontSelect.svelte';
    import AccessibilitySelect from '@idstead/ui/components/filter/AccessibilitySelect.svelte';
    import IconButton from '@idstead/ui/components/IconButton.svelte';
    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import { type SocialLink } from '#lib/author.ts';
    import BrandIcon from '#lib/components/BrandIcon.svelte';
    import FooterSiteLink from './FooterSiteLink.svelte';
    import { FOOTER_SITE_LINKS } from './footerLinks';
    import { isHiddenLegalPath } from '#app/legalVisibility.ts';
    import StatusBadge from '@idstead/ui/components/StatusBadge.svelte';
    import * as publicEnv from '$app/env/public';
    import { BookOpenText } from '@lucide/svelte';

    import { page } from '$app/state';

    interface NavItem {
        label: string;
        url: string;
    }

    interface Props {
        navItems?: NavItem[];
        socials?: SocialLink[];
        onNavClick?: (url: string) => void;
        showFontSelect?: boolean;
        readingMode?: boolean;
        onToggleReadingMode?: () => void;
        width?: 'standard' | 'full' | 'reading';
        divided?: boolean;
        class?: string;
    }

    const defaultNavItems: NavItem[] = [
        { label: 'Home', url: '/' },
        { label: 'Projects', url: '/projects' },
        { label: 'Blog', url: '/blog' },
        { label: 'CV', url: '/cv' },
        { label: 'Funding', url: '/funding' },
        { label: 'Contact', url: '/contact' }
    ];

    let {
        navItems = [],
        socials = [],
        onNavClick,
        showFontSelect = false,
        readingMode = false,
        onToggleReadingMode,
        width = 'standard',
        divided = false,
        class: className = ''
    }: Props = $props();

    const widthStyles = {
        standard: 'px-3 sm:px-6 md:w-[80%] lg:w-[50%]',
        reading: 'px-3 sm:px-6 md:w-[80%] lg:w-[50%]',
        full: 'w-full max-w-full px-0'
    };

    let pageAuthor = $derived((page?.data as any)?.author);

    let copyrightName = $derived(pageAuthor?.name || '');

    let resolvedNavItems = $derived(navItems.length > 0 ? navItems : defaultNavItems);

    let resolvedSocials = $derived(
        Array.isArray(socials) && socials.length > 0 ? socials
        : pageAuthor?.socialLinks && pageAuthor.socialLinks.length > 0 ? pageAuthor.socialLinks
        : []
    );

    const siteLinks = $derived(FOOTER_SITE_LINKS.filter(item => !isHiddenLegalPath(item.href)));
</script>

<footer
    class={cn(
        'relative z-10 mx-auto mt-auto w-full max-w-full pt-0 font-sans text-xs text-text-muted',
        width === 'standard' ? 'pb-8' : 'pb-0',
        widthStyles[width],
        className
    )}>
    {#if divided}
        <div
            class="mt-2 mb-6 w-full border-t border-border-subtle/60"
            aria-hidden="true">
        </div>
    {/if}
    <div class="rounded-md glass-card p-3.5 sm:p-6">
        <div class="flex flex-col gap-5 sm:gap-6">
            <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-10">
                {#if resolvedNavItems.length > 0}
                    <nav
                        aria-label="Footer navigation"
                        class="flex min-w-0 flex-col gap-2">
                        <h4 class="text-xs font-semibold text-text-primary">Navigation</h4>
                        <ul
                            class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-normal text-text-secondary">
                            {#each resolvedNavItems as item (item.url)}
                                <li class="text-xs">
                                    {#if onNavClick}
                                        <button
                                            type="button"
                                            onclick={() => onNavClick(item.url)}
                                            use:shortcut={{
                                                combo: sectionCommandKey(item.url),
                                                label: item.label
                                            }}
                                            class="relative cursor-pointer text-left text-xs font-normal text-text-secondary transition-colors hover:text-accent-text focus-visible:text-accent-text focus-visible:outline-none">
                                            {item.label}
                                        </button>
                                    {:else}
                                        <a
                                            href={item.url}
                                            use:shortcut={{
                                                combo: sectionCommandKey(item.url),
                                                label: item.label
                                            }}
                                            class="relative cursor-pointer text-left text-xs font-normal text-text-secondary transition-colors hover:text-accent-text focus-visible:text-accent-text focus-visible:outline-none">
                                            {item.label}
                                        </a>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </nav>
                {/if}

                <nav
                    aria-label="Site links"
                    class="flex min-w-0 flex-col gap-2">
                    <h4 class="text-xs font-semibold text-text-primary">Site</h4>
                    <ul
                        class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-normal text-text-secondary">
                        {#each siteLinks as item (item.label)}
                            <li class="text-xs">
                                <FooterSiteLink
                                    {item}
                                    class="text-xs font-normal text-text-secondary" />
                            </li>
                        {/each}
                    </ul>
                </nav>
            </div>

            <div
                class="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4 sm:pt-5">
                {#if resolvedSocials.length > 0}
                    <div class="flex flex-wrap gap-2">
                        {#each resolvedSocials as item (item.url + item.platform)}
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={item.platform}
                                title={item.platform}
                                use:shortcut={{ group: 'social', label: item.platform }}
                                class="relative flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-text-muted transition-all hover:bg-surface-hover hover:text-accent-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:size-9">
                                <BrandIcon
                                    icon={item.icon}
                                    class="size-4 text-base leading-none sm:size-4.5 sm:text-lg" />
                            </a>
                        {/each}
                    </div>
                {/if}

                <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
                            class="border-border-subtle bg-surface backdrop-blur-none hover:border-accent hover:bg-surface-hover sm:h-9 sm:w-9 {(
                                readingMode
                            ) ?
                                'border-accent text-accent-text'
                            :   ''}">
                            <BookOpenText class="size-4" />
                        </IconButton>
                    {/if}
                    <ThemeSelect
                        theme={themeStore.current}
                        onThemeChange={themeStore.apply}
                        dropdownDirection="up" />
                    {#if showFontSelect}
                        <ContentFontSelect dropdownDirection="up" />
                    {/if}
                    <AccessibilitySelect dropdownDirection="up" />
                </div>
            </div>

            <div
                class="flex flex-col items-center gap-3 border-t border-border-subtle pt-4 text-center select-none sm:flex-row sm:justify-between sm:pt-5 sm:text-left">
                <span class="text-xs font-medium text-text-muted">
                    &copy; {new Date().getFullYear()}{copyrightName ? ` ${copyrightName}.` : '.'}
                </span>
                <StatusBadge
                    host={publicEnv.PUBLIC_STATUS_PAGE_HOST}
                    code={publicEnv.PUBLIC_STATUS_PAGE_CODE} />
            </div>
        </div>
    </div>
</footer>

<style>
    @reference '@idstead/ui/styles/global.css';

    footer {
        @apply font-sans text-xs leading-normal font-normal not-italic;
    }

    h4 {
        @apply text-xs font-semibold not-italic;
    }
</style>
