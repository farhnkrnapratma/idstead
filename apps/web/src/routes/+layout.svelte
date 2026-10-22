<script lang="ts">
    import { themeColors } from '@idstead/ui/themeColors.ts';
    import '#lib/global.css';
    import { onMount } from 'svelte';
    import { installSubmitShortcut } from '@idstead/ui/utils/submitShortcut.ts';
    import { onNavigate } from '$app/navigation';
    import { page } from '$app/state';
    import * as publicEnv from '$app/env/public';
    import { apiUrl } from '#lib/apiConfig.ts';
    import ConsentBanner from '#app/components/ConsentBanner.svelte';
    import FeedbackButton from '#app/components/FeedbackButton.svelte';
    import { Toast, ScrollToTopButton } from '@idstead/ui';
    import ShortcutCatalogDialog from '@idstead/ui/components/ShortcutCatalogDialog.svelte';
    import ShortcutModeIndicator from '@idstead/ui/components/ShortcutModeIndicator.svelte';
    import { platformStore } from '@idstead/ui/stores/platformStore.svelte.ts';

    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import { a11yStore } from '@idstead/ui/stores/a11yStore.svelte.ts';
    import { codeBlockPrefsStore } from '@mdrs/dom/codeBlockPrefsStore.svelte.ts';
    import { scrollStore } from '@idstead/ui/stores/scrollStore.svelte.ts';
    import { readingModeStore } from '@idstead/ui/stores/readingModeStore.svelte.ts';
    import { refreshCodeBlockPrefs } from '@mdrs/dom/codeBlocks.ts';

    const { data, children } = $props();

    let name = $derived(data?.author?.name || '');
    let siteUrl = $derived((data?.author?.siteUrl || '').replace(/\/$/, ''));

    let feedTitle = $derived(
        name ?
            `${name}${siteUrl ? ` (${siteUrl}/blog)` : ''} — RSS Feed`
        :   `${siteUrl ? siteUrl.replace(/^https?:\/\//, '') + '/blog' : 'Blog'} — RSS Feed`
    );

    const isBlogPost = $derived(page.route.id === '/blog/[slug]');
    const isLegalPage = $derived(
        page.route.id === '/terms' || page.route.id === '/privacy' || page.route.id === '/security'
    );
    const isArticleLikePage = $derived(isBlogPost || isLegalPage);
    const isPageWithFeedback = $derived(!page.error && page.url.pathname !== '/feedback');

    onMount(() => {
        platformStore.detect();
        const cleanupTheme = themeStore.init();
        const cleanupA11y = a11yStore.init();
        const cleanupCodeBlockPrefs = codeBlockPrefsStore.init(refreshCodeBlockPrefs);
        const cleanupScroll = scrollStore.init();
        const cleanupSubmitShortcut = installSubmitShortcut();
        return () => {
            cleanupTheme?.();
            cleanupA11y?.();
            cleanupCodeBlockPrefs?.();
            cleanupScroll?.();
            cleanupSubmitShortcut();
        };
    });

    $effect(() => {
        if (typeof document !== 'undefined') {
            if (readingModeStore.active) {
                document.documentElement.dataset.readingMode = 'true';
                document.documentElement.classList.add('reading-mode');
            } else {
                delete document.documentElement.dataset.readingMode;
                document.documentElement.classList.remove('reading-mode');
            }
        }
    });

    const BLOG_POST_ROUTE_ID = '/blog/[slug]';

    onNavigate(navigation => {
        if (navigation.shallow || !document.startViewTransition || a11yStore.current.reduceMotion)
            return;

        const isBlogPostTransition =
            navigation.to?.route.id === BLOG_POST_ROUTE_ID
            || navigation.from?.route.id === BLOG_POST_ROUTE_ID;
        if (!isBlogPostTransition) return;

        return new Promise(resolve => {
            const root = document.documentElement;
            root.dataset.transitionType = 'drill';
            const transition = document.startViewTransition(async () => {
                resolve();
                await navigation.complete;
            });
            void transition.finished.finally(() => {
                delete root.dataset.transitionType;
            });
        });
    });
</script>

<svelte:head>
    <link
        rel="manifest"
        href="/site.webmanifest" />
    <link
        rel="icon"
        type="image/x-icon"
        href="/favicon.ico" />
    <link
        rel="icon"
        type="image/png"
        sizes="16x16"
        href="/favicon-16x16.png" />
    <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href="/favicon-32x32.png" />
    {#if data?.author?.avatarVersion}
        <link
            rel="icon"
            type="image/svg+xml"
            sizes="any"
            href="/favicon.svg" />
    {/if}
    <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/apple-touch-icon.png" />
    <meta
        name="theme-color"
        content={themeColors(themeStore.isDark ? 'dark' : 'light').theme_color} />
    <link
        rel="alternate"
        type="application/atom+xml"
        title={feedTitle}
        href="/atom.xml" />
    <link
        rel="describedby"
        type="text/markdown"
        title="LLM & AI Agent Directory"
        href="/llms.txt" />
    <link
        rel="describedby"
        type="text/markdown"
        title="Public API documentation"
        href={apiUrl('', publicEnv.PUBLIC_API_BASE_URL)} />
</svelte:head>

{@render children()}

<ScrollToTopButton
    show={scrollStore.pastThreshold && !readingModeStore.active}
    class={isArticleLikePage ? 'lg:hidden' : ''} />
<FeedbackButton
    show={isPageWithFeedback && !readingModeStore.active}
    class={isArticleLikePage ? 'lg:hidden' : ''} />

<ConsentBanner />
<Toast />
<ShortcutCatalogDialog />
<ShortcutModeIndicator />
