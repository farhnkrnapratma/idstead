<script lang="ts">
    import { createFeedbackClient } from '#lib/feedbackClient.svelte.ts';
    import { tick, onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';
    import { BookOpenText } from '@lucide/svelte';
    import { refreshCodeBlockPrefs } from '#lib/utils/codeBlocks.ts';
    import { codeBlockPrefsStore } from '#lib/stores/codeBlockPrefsStore.svelte.ts';
    import {
        TopNav,
        TableOfContents,
        HelpfulBlock,
        Toast,
        ContentActions,
        FooterSection,
        SkipLink,
        Tooltip,
        FeedbackButton,
        ScrollToTopButton
    } from '#lib/index.ts';
    import ArticleHeader from '#lib/article/ArticleHeader.svelte';
    import ArticleMeta from '#lib/article/ArticleMeta.svelte';
    import { toastStore } from '#lib/stores/toastStore.svelte.ts';
    import { readingModeStore } from '#lib/stores/readingModeStore.svelte.ts';
    import type { HeadingItem } from '#lib/markdown.ts';
    import { formatReadTime } from '#lib/utils/formatters.ts';
    import { countReadingMinutes } from '#lib/readTime.ts';
    import { enhanceMarkdownContent } from '#lib/utils/markdownEnhancer.ts';
    import { enhanceHeadingAnchors } from '#lib/utils/headingAnchors.ts';
    import { highlightAfterScroll } from '#lib/utils/scroll.ts';
    import hljs from 'highlight.js';
    import 'katex/dist/katex.min.css';
    import { contentFontStore } from '#lib/stores/contentFontStore.svelte.ts';
    import { pushState, goto } from '$app/navigation';
    import { page } from '$app/state';

    interface Props {
        title: string;
        slug: string;
        content: string;
        html: string;
        headings: HeadingItem[];
        date?: string;
        updatedAt?: string;
        authorName?: string;
        siteUrl?: string;
    }

    let {
        title,
        slug,
        content,
        html,
        headings = [],
        date,
        updatedAt,
        authorName = '',
        siteUrl = ''
    }: Props = $props();

    let pageProjects = $derived((page?.data as any)?.projects ?? []);

    const feedback = createFeedbackClient(() => ({ type: 'legal', id: slug }));
    let isDark = $state(false);

    const estimatedMinutes = $derived(content ? countReadingMinutes(content) : 1);
    const readingTime = $derived(formatReadTime(estimatedMinutes));

    let articleScrollTop = $state(0);
    let articleScrollHeight = $state(0);
    let articleClientHeight = $state(0);

    const articleScrollProgress = $derived(
        articleScrollHeight - articleClientHeight > 0 ?
            (articleScrollTop / (articleScrollHeight - articleClientHeight)) * 100
        :   0
    );
    const isArticleScrolledPast = $derived(articleScrollTop > 300);

    function handleArticleScroll(e: Event) {
        const target = e.currentTarget as HTMLElement;
        articleScrollTop = target.scrollTop;
        articleScrollHeight = target.scrollHeight;
        articleClientHeight = target.clientHeight;
    }

    let articleEl = $state<HTMLElement | null>(null);
    let articleBodyEl: HTMLDivElement | undefined = $state();
    let cancelHighlight: (() => void) | undefined;

    function scrollToTarget(targetId: string, smooth = true) {
        const targetEl = document.getElementById(targetId);
        if (!targetEl) return;

        const isDesktop =
            typeof window !== 'undefined'
            && window.matchMedia('(min-width: 1024px)').matches
            && !readingModeStore.active;

        if (isDesktop && articleEl) {
            const containerRect = articleEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const currentScrollTop = articleEl.scrollTop;
            const targetScrollTop = currentScrollTop + (targetRect.top - containerRect.top) - 32;

            articleEl.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: smooth ? 'smooth' : 'auto'
            });

            if (window.scrollY !== 0) {
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
            const mainEl = document.getElementById('main-content');
            if (mainEl && mainEl.scrollTop !== 0) {
                mainEl.scrollTop = 0;
            }
        } else {
            const topNavHeight = 56;
            const targetRect = targetEl.getBoundingClientRect();
            const targetWindowTop = window.scrollY + targetRect.top - topNavHeight - 20;

            window.scrollTo({
                top: Math.max(0, targetWindowTop),
                behavior: smooth ? 'smooth' : 'auto'
            });
        }

        cancelHighlight?.();
        cancelHighlight = highlightAfterScroll(
            targetEl,
            isDesktop && articleEl ? articleEl : window
        );
    }

    function handleArticleLinkClick(e: MouseEvent) {
        if (
            e.defaultPrevented
            || e.button !== 0
            || e.ctrlKey
            || e.metaKey
            || e.shiftKey
            || e.altKey
            || !(e.target instanceof Element)
        )
            return;

        const link = e.target.closest<HTMLAnchorElement>('a[href^="#"]');
        if (
            !link
            || !articleEl?.contains(link)
            || link.hasAttribute('download')
            || (link.target && link.target !== '_self')
        )
            return;
        const href = link.getAttribute('href');
        if (!href || href === '#' || !href.startsWith('#')) return;

        const targetId = href.slice(1);
        const targetEl = document.getElementById(targetId);
        if (!targetEl) return;

        e.preventDefault();
        pushState(`#${targetId}`, {});
        scrollToTarget(targetId, true);
    }

    function scrollArticleToTop() {
        if (articleEl) {
            articleEl.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function triggerToast(message: string, isError = false) {
        if (isError) {
            toastStore.error(message);
        } else {
            toastStore.success(message);
        }
    }

    $effect(() => {
        void html;
        void isDark;

        tick().then(() => {
            const container = articleBodyEl;
            if (container) {
                const blocks = container.querySelectorAll('pre code');
                blocks.forEach(block => {
                    hljs.highlightElement(block as HTMLElement);
                });
                enhanceMarkdownContent({ container, isDark, onCodeCopy: triggerToast });
                enhanceHeadingAnchors(container);
            }
        });
    });

    $effect(() => {
        void codeBlockPrefsStore.current;
        void readingModeStore.active;
        refreshCodeBlockPrefs();
    });

    onDestroy(() => {
        readingModeStore.disable();
        cancelHighlight?.();
    });

    onMount(() => {
        isDark = document.documentElement.classList.contains('dark');

        const observer = new MutationObserver(() => {
            isDark = document.documentElement.classList.contains('dark');
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        if (typeof window !== 'undefined' && window.location.hash) {
            const hashId = window.location.hash.slice(1);
            tick().then(() => {
                scrollToTarget(hashId, false);
            });
        }

        function handlePopState() {
            if (typeof window !== 'undefined' && window.location.hash) {
                const hashId = window.location.hash.slice(1);
                scrollToTarget(hashId, true);
            }
        }
        window.addEventListener('popstate', handlePopState);

        return () => {
            observer.disconnect();
            window.removeEventListener('popstate', handlePopState);
        };
    });
</script>

<svelte:head>
    <title>{title}{authorName ? ` — ${authorName}` : ''}</title>
    <meta
        name="description"
        content="{title}{authorName ? ` for ${authorName} portfolio and services.` : ''}" />
    {#if siteUrl}
        <link
            rel="canonical"
            href="{siteUrl}/{slug}" />
    {/if}
</svelte:head>

<svelte:body onclick={handleArticleLinkClick} />

<SkipLink />

{#if !readingModeStore.active}
    <TopNav
        ariaLabel="{title} navigation"
        backHref="/"
        backLabel="Home"
        showFontSelect={true}
        projects={pageProjects}
        readingMode={readingModeStore.active}
        onToggleReadingMode={readingModeStore.toggle} />
{/if}

<main
    id="main-content"
    class="flex flex-col font-sans {readingModeStore.active ?
        'min-h-screen pt-4 sm:pt-6'
    :   'min-h-[calc(100vh-3rem)] overscroll-none pt-12 sm:min-h-[calc(100vh-3.5rem)] sm:pt-14 lg:h-dvh lg:min-h-0 lg:overflow-clip'}">
    <div
        class={readingModeStore.active ?
            'relative mx-auto w-full px-3 pt-3 pb-16 sm:px-6 sm:pt-4 md:w-[80%] lg:w-[50%]'
        :   'relative mx-auto w-full px-3 pt-5 pb-16 sm:px-6 sm:pt-6 md:w-[80%] md:pt-8 lg:mx-0 lg:grid lg:h-full lg:w-full lg:max-w-none lg:grid-cols-[25%_50%_25%] lg:grid-rows-[minmax(0,1fr)] lg:items-start lg:gap-0 lg:px-0 lg:pt-0 lg:pb-0'}>
        {#if !readingModeStore.active}
            <aside
                transition:fade={{ duration: 150 }}
                class="hidden select-none lg:sticky lg:top-0 lg:z-20 lg:flex lg:max-h-full lg:w-full lg:flex-col lg:overflow-hidden lg:px-3 lg:pt-[1.25vw] lg:pb-[1.25vw] [&>*+*]:lg:mt-4"
                aria-label="Table of contents">
                <TableOfContents
                    title="In this article"
                    {headings}
                    scrollLinkedEl={articleEl}
                    class="min-h-0 w-full flex-1 scrollbar-none overflow-hidden [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" />
            </aside>
        {/if}

        <article
            bind:this={articleEl}
            onscroll={handleArticleScroll}
            class="article-scroll-container flex w-full min-w-0 flex-col lg:h-full lg:max-h-full lg:overflow-y-auto lg:px-[5%] lg:pt-[1.25vw] lg:pb-0">
            <ArticleHeader
                {title}
                titleClass="text-text-primary">
                {#snippet meta()}
                    <ArticleMeta
                        layout="single"
                        {date}
                        {updatedAt}
                        {readingTime}
                        class="mt-2.5 w-full" />

                    {#if !readingModeStore.active}
                        <div
                            transition:fade={{ duration: 150 }}
                            class="w-full lg:hidden">
                            <ContentActions
                                class="mt-3 w-full"
                                {slug}
                                {title}
                                markdownContent={content}
                                showCopyUrl={false}
                                viewMarkdownUrl="/{slug}.md"
                                viewTextUrl="/{slug}.txt"
                                pageUrl={siteUrl ? `${siteUrl}/${slug}` : undefined} />
                        </div>
                    {/if}
                {/snippet}
            </ArticleHeader>

            {#if !readingModeStore.active}
                <div class="mt-3 flex flex-col lg:hidden">
                    <TableOfContents
                        title="In this article"
                        {headings}
                        collapsible={true}
                        defaultCollapsed={true} />
                </div>
            {/if}

            <div
                bind:this={articleBodyEl}
                class="prose-custom font-content-{contentFontStore.current} mt-3 w-full">
                {@html html}
            </div>

            {#if !readingModeStore.active}
                <div class="mt-8">
                    <HelpfulBlock
                        title="Help improve this page"
                        subtitle="Was this page helpful to you?"
                        shareLabel="Share this page"
                        voted={feedback.voted}
                        pending={feedback.pending}
                        error={feedback.error}
                        onVote={helpful => feedback.vote(helpful ? 'yes' : 'no')}
                        onFeedbackClick={() => goto('/feedback')} />
                </div>
            {/if}

            {#if !readingModeStore.active}
                <div
                    class="mt-8 mb-6 w-full border-t border-border-subtle/60"
                    aria-hidden="true">
                </div>

                <FooterSection
                    width="full"
                    showFontSelect={true}
                    readingMode={readingModeStore.active}
                    onToggleReadingMode={readingModeStore.toggle}
                    class="mt-0 w-full pb-0 md:pb-0 lg:pb-20" />
            {/if}
        </article>

        {#if !readingModeStore.active}
            <aside
                transition:fade={{ duration: 150 }}
                class="article-scroll-container hidden select-none lg:sticky lg:top-0 lg:z-20 lg:flex lg:max-h-full lg:w-full lg:flex-col lg:overflow-y-auto lg:px-3 lg:pt-[1.25vw] lg:pb-[1.25vw] [&>*+*]:lg:mt-4"
                aria-label="Article actions">
                <ContentActions
                    variant="sidebar"
                    class="w-full shrink-0"
                    {slug}
                    {title}
                    markdownContent={content}
                    showCopyUrl={false}
                    viewMarkdownUrl="/{slug}.md"
                    viewTextUrl="/{slug}.txt"
                    pageUrl={siteUrl ? `${siteUrl}/${slug}` : undefined} />
            </aside>
        {/if}
    </div>
</main>

<FeedbackButton
    show={!readingModeStore.active}
    class="hidden lg:fixed lg:bottom-6 lg:left-[calc(25%+(2.5vw-0.75rem)/2)] lg:z-40 lg:block lg:-translate-x-1/2" />

<ScrollToTopButton
    show={isArticleScrolledPast && !readingModeStore.active}
    onClick={scrollArticleToTop}
    progress={articleScrollProgress}
    class="hidden lg:fixed lg:right-[calc(25%+(2.5vw-0.75rem)/2)] lg:bottom-6 lg:z-40 lg:block lg:translate-x-1/2" />

{#if readingModeStore.active}
    <div
        transition:fade={{ duration: 150 }}
        class="fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 md:right-6 md:bottom-6 lg:right-[calc(25%+(2.5vw-0.75rem)/2)] lg:translate-x-1/2">
        <Tooltip
            content="Exit reading mode"
            placement="top"
            align="right">
            <button
                type="button"
                class="inline-flex size-8 cursor-pointer items-center justify-center rounded-full glass-button border border-accent/40 bg-surface-card/90 px-0 text-xs font-semibold text-accent-text shadow-md transition-all hover:scale-105 hover:border-accent hover:bg-surface-hover active:scale-95 md:shadow-lg"
                onclick={readingModeStore.toggle}
                aria-label="Exit reading mode">
                <BookOpenText class="size-4 shrink-0" />
            </button>
        </Tooltip>
    </div>
{/if}

<Toast />
