<script lang="ts">
    import { themeColors } from '#lib/themeColors.ts';
    import '#lib/global.css';
    import { onMount } from 'svelte';
    import { installSubmitShortcut } from '#lib/utils/submitShortcut.ts';
    import { onNavigate } from '$app/navigation';
    import { page } from '$app/state';
    import { ConsentBanner, Toast, ScrollToTopButton, FeedbackButton } from '#lib/index.ts';
    import ShortcutCatalogDialog from '#lib/components/ShortcutCatalogDialog.svelte';
    import ShortcutModeIndicator from '#lib/components/ShortcutModeIndicator.svelte';
    import { platformStore } from '#lib/stores/platformStore.svelte.ts';

    import { themeStore } from '#lib/stores/themeStore.svelte.ts';
    import { a11yStore } from '#lib/stores/a11yStore.svelte.ts';
    import { codeBlockPrefsStore } from '#lib/stores/codeBlockPrefsStore.svelte.ts';
    import { scrollStore } from '#lib/stores/scrollStore.svelte.ts';
    import { readingModeStore } from '#lib/stores/readingModeStore.svelte.ts';
    import { refreshCodeBlockPrefs } from '#lib/utils/codeBlocks.ts';

    const { data, children } = $props();

    let name = $derived(data?.author?.name || '');
    let siteUrl = $derived((data?.author?.siteUrl || '').replace(/\/$/, ''));

    let feedTitle = $derived(
        name ?
            `${name}${siteUrl ? ` (${siteUrl}/blog)` : ''} — RSS Feed`
        :   `${siteUrl ? siteUrl.replace(/^https?:\/\//, '') + '/blog' : 'Blog'} — RSS Feed`
    );

    const isAdminPage = $derived(page.url.pathname.startsWith('/admin'));
    const isBlogPost = $derived(page.route.id === '/blog/[slug]');
    const isLegalPage = $derived(
        page.route.id === '/terms' || page.route.id === '/privacy' || page.route.id === '/security'
    );
    const isArticleLikePage = $derived(isBlogPost || isLegalPage);
    const isPageWithFeedback = $derived(
        !page.error && page.url.pathname !== '/feedback' && !page.url.pathname.startsWith('/admin')
    );

    onMount(() => {
        if (isAdminPage) {
            document.documentElement.dataset.adminPage = 'true';
        } else {
            delete document.documentElement.dataset.adminPage;
        }
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
        const destinationPath = navigation.to?.url.pathname;
        if (destinationPath) {
            if (destinationPath.startsWith('/admin')) {
                document.documentElement.dataset.adminPage = 'true';
            } else {
                delete document.documentElement.dataset.adminPage;
            }
        }

        if (!document.startViewTransition || a11yStore.current.reduceMotion) return;

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
        href={`/site.webmanifest?theme=${themeStore.isDark ? 'dark' : 'light'}&v=${data?.author?.revision ?? 0}`} />
    <link
        rel="icon"
        type="image/x-icon"
        href={`/favicon.ico${data?.author?.avatarVersion ? `?v=${data.author.avatarVersion}` : ''}`} />
    <link
        rel="icon"
        type="image/png"
        sizes="16x16"
        href={`/favicon-16x16.png${data?.author?.avatarVersion ? `?v=${data.author.avatarVersion}` : ''}`} />
    <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href={`/favicon-32x32.png${data?.author?.avatarVersion ? `?v=${data.author.avatarVersion}` : ''}`} />
    {#if data?.author?.avatarVersion}
        <link
            rel="icon"
            type="image/svg+xml"
            sizes="any"
            href={`/favicon.svg?v=${data.author.avatarVersion}`} />
    {/if}
    <link
        rel="apple-touch-icon"
        sizes="180x180"
        href={`/apple-touch-icon.png${data?.author?.avatarVersion ? `?v=${data.author.avatarVersion}` : ''}`} />
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
        href="/api/v1" />
</svelte:head>

{@render children()}

<ScrollToTopButton
    show={scrollStore.pastThreshold && !isAdminPage && !readingModeStore.active}
    class={isArticleLikePage ? 'lg:hidden' : ''} />
<FeedbackButton
    show={isPageWithFeedback && !readingModeStore.active}
    class={isArticleLikePage ? 'lg:hidden' : ''} />

<ConsentBanner />
<Toast />
<ShortcutCatalogDialog />
<ShortcutModeIndicator />
