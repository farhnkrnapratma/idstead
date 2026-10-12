<script lang="ts">
    import Avatar from '#lib/components/Avatar.svelte';
    import { COMMENTS_PAGE_SIZE, commentAuthorName } from '#lib/commentAuthor.ts';
    import { blogBannerAlt } from '#lib/blogBanner.ts';
    import { createFeedbackClient } from '#lib/feedbackClient.svelte.ts';
    import { shortcut } from '#lib/utils/shortcut.svelte.ts';
    import { buttonKey } from '#lib/shortcuts.ts';
    import { focusScope } from '#lib/utils/focusScope.ts';
    import { FieldValidation, requiredText } from '#lib/fieldValidation.ts';
    import { onMount, onDestroy, tick, untrack } from 'svelte';
    import { fade } from 'svelte/transition';
    import { SvelteSet } from 'svelte/reactivity';
    import { Image as ImageIcon, BookOpenText, Pin, Sparkles } from '@lucide/svelte';
    import type { PageProps } from './$types';
    import type { BlogComment } from './+page.server';
    import hljs from 'highlight.js';
    import { isNameReserved, extractAuthorNameTokens } from '#lib/utils/nameValidator.ts';
    import { enhanceMarkdownContent } from '#lib/utils/markdownEnhancer.ts';
    import { enhanceHeadingAnchors } from '#lib/utils/headingAnchors.ts';
    import { refreshCodeBlockPrefs } from '#lib/utils/codeBlocks.ts';
    import 'katex/dist/katex.min.css';
    import {
        turnstileWidget,
        executeTurnstile,
        resetTurnstile,
        turnstileSiteKey
    } from '#lib/utils/turnstile.ts';
    import {
        TopNav,
        Button,
        Card,
        Tag,
        decodeHtmlEntities,
        ImageWithSkeleton,
        CommentThread,
        EmptyState,
        StatusBanner,
        FormField,
        Input,
        Textarea,
        FooterSection,
        TableOfContents,
        RelativeTime,
        ContentActions,
        toastStore,
        formatReadTime,
        Dialog,
        ReportCommentDialog,
        ArticleHeader,
        ShareDialog,
        QrCodeDialog,
        ArticleMeta,
        HelpfulBlock,
        SubscribeForm,
        PostInsights,
        ConsentNotice,
        readingModeStore,
        Tooltip,
        ScrollToTopButton,
        FeedbackButton
    } from '#lib/index.ts';
    import { pushState } from '$app/navigation';
    import { page, navigating } from '$app/state';
    import { contentFontStore } from '#lib/stores/contentFontStore.svelte.ts';
    import { codeBlockPrefsStore } from '#lib/stores/codeBlockPrefsStore.svelte.ts';

    let { data }: PageProps = $props();
    const post = $derived(data.post);
    const isNavigatingToBlogPost = $derived(navigating.to?.route.id === '/blog/[slug]');
    const html = $derived(data.html);
    const author = $derived(data.author);
    const authorTokens = $derived(extractAuthorNameTokens(author));

    const NEW_ITEM_WINDOW_MS = 24 * 60 * 60 * 1000;
    function isPostNew(postItem: { created_at?: string | null }) {
        if (!postItem.created_at) return false;
        return Date.now() - new Date(postItem.created_at).getTime() < NEW_ITEM_WINDOW_MS;
    }

    function triggerToast(message: string) {
        toastStore.show(message);
    }

    let currentPostId: string | null = null;
    let addedComments = $state<BlogComment[]>([]);
    $effect(() => {
        const postId = data.post.id;
        if (currentPostId !== postId) {
            currentPostId = postId;
            untrack(() => {
                addedComments = [];
                readingModeStore.disable();
            });
        }
    });
    const comments = $derived([...data.comments, ...addedComments]);
    const relatedPosts = $derived(data.relatedPosts);
    const failedRelatedBanners = new SvelteSet<string>();
    function markRelatedBannerFailed(postId: string) {
        failedRelatedBanners.add(postId);
    }

    const expandedExcerptIds = new SvelteSet<string>();
    const overflowingExcerptIds = new SvelteSet<string>();

    function observeExcerptOverflow(postId: string) {
        return (element: HTMLElement) => {
            const updateOverflow = () => {
                if (element.scrollHeight > element.clientHeight + 1) {
                    overflowingExcerptIds.add(postId);
                } else {
                    overflowingExcerptIds.delete(postId);
                }
            };

            const resizeObserver = new ResizeObserver(updateOverflow);
            resizeObserver.observe(element);

            return () => resizeObserver.disconnect();
        };
    }

    function toggleExcerpt(postId: string) {
        if (expandedExcerptIds.has(postId)) {
            expandedExcerptIds.delete(postId);
        } else {
            expandedExcerptIds.add(postId);
        }
    }

    let isDark = $state(false);

    const bannerPublicUrl = $derived(data.bannerPublicUrl || '');
    const bannerSocialUrl = $derived(
        bannerPublicUrl && author?.siteUrl ? new URL(bannerPublicUrl, author.siteUrl).href : ''
    );

    const headings = $derived(data.headings || []);

    let showYesFeedbackDialog = $state(false);
    let showNoFeedbackDialog = $state(false);
    let showQrDialog = $state(false);
    let viewCount = $state<number | null>(untrack(() => data.initialViewsCount ?? null));

    const mainAuthorUsername = $derived(author?.username || 'farhnkrnapratma');
    const collaboratorsList = $derived(
        Array.isArray(post.collaborators) ? post.collaborators.filter(Boolean) : []
    );
    const allAuthors = $derived([mainAuthorUsername, ...collaboratorsList]);
    const visibleAvatarAuthors = $derived(allAuthors.slice(0, 3));
    const hiddenCollaborators = $derived(allAuthors.slice(3));
    let isCollaboratorsPopoverOpen = $state(false);
    let collaboratorsContainerRef: HTMLDivElement | undefined = $state();

    const feedback = createFeedbackClient(() => ({ type: 'article', id: post.id }));

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

    function scrollArticleToTop() {
        if (articleBodyEl) {
            const container = articleBodyEl.closest(
                '.article-scroll-container'
            ) as HTMLElement | null;
            if (container) {
                container.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    let articleEl = $state<HTMLElement | null>(null);
    let articleBodyEl: HTMLDivElement | undefined = $state();
    let highlightTimer: ReturnType<typeof setTimeout> | undefined;

    function highlightTarget(el: HTMLElement) {
        document
            .querySelectorAll('.footnote-target-highlight')
            .forEach(node => node.classList.remove('footnote-target-highlight'));

        const highlightEl = (el.closest('sup') || el) as HTMLElement;
        highlightEl.classList.add('footnote-target-highlight');

        if (highlightTimer) clearTimeout(highlightTimer);
        highlightTimer = setTimeout(() => {
            highlightEl.classList.remove('footnote-target-highlight');
        }, 1800);
    }

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

        highlightTarget(targetEl);
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
        if (highlightTimer) clearTimeout(highlightTimer);
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

        (async () => {
            try {
                const res = await fetch('/api/internal/blog/views', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ postId: post.id })
                });
                const data = await res.json();
                viewCount = typeof data.views === 'number' ? data.views : null;
            } catch {
                viewCount = null;
            }
        })();

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

    let authorName = $state('');
    let commentContent = $state('');
    let replyTo = $state<BlogComment | null>(null);
    let isSubmitting = $state(false);
    let turnstileEl = $state<HTMLDivElement | null>(null);
    let feedbackMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

    let showReportDialog = $state(false);
    let reportingComment = $state<BlogComment | null>(null);

    function getCommentAuthor(comment: BlogComment) {
        return commentAuthorName(comment, author?.name || '');
    }

    function cancelReply() {
        replyTo = null;
        commentContent = '';
        feedbackMessage = null;
        validation.reset();
        errors = { authorName: '', commentContent: '' };
        valid = { authorName: false, commentContent: false };
    }

    const canClearComment = $derived(Boolean(authorName.trim() || commentContent.trim()));

    function clearCommentForm() {
        authorName = '';
        commentContent = '';
        feedbackMessage = null;
        validation.reset();
        errors = { authorName: '', commentContent: '' };
        valid = { authorName: false, commentContent: false };
    }

    let errors = $state({ authorName: '', commentContent: '' });
    let valid = $state({ authorName: false, commentContent: false });

    const validation = new FieldValidation();
    onDestroy(() => validation.destroy());
    validation.register('authorName', {
        value: () => authorName,
        baseline: () => '',
        validate: value =>
            requiredText('Name', 50)(value)
            || (value.trim().length < 2 ? 'Name must be at least 2 characters.'
            : isNameReserved(value, authorTokens) ?
                'This name cannot be used. Please use another name.'
            :   ''),
        report: result => {
            errors.authorName = result.error;
            valid.authorName = result.valid;
        }
    });
    validation.register('commentContent', {
        value: () => commentContent,
        baseline: () => '',
        validate: value =>
            requiredText('Message', 2000)(value)
            || (/(https?:\/\/|www\.[a-z0-9]|ftp:\/\/)/i.test(value) ?
                'Links and URLs are not permitted in guest comments.'
            :   ''),
        report: result => {
            errors.commentContent = result.error;
            valid.commentContent = result.valid;
        }
    });
    function sanitizeInput(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    function validate() {
        return validation.submit(undefined, true);
    }

    async function handleSubmit(e: SubmitEvent, parentId: string | null = null) {
        e.preventDefault();
        if (!(await validate())) return;

        const turnstileToken = await executeTurnstile(turnstileEl);
        if (!turnstileToken) {
            feedbackMessage = {
                type: 'error',
                text: 'Please complete the verification challenge before submitting.'
            };
            return;
        }

        isSubmitting = true;
        feedbackMessage = null;

        try {
            const res = await fetch('/api/internal/blog/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId: post.id,
                    parentId,
                    authorName: sanitizeInput(authorName.trim()),
                    content: sanitizeInput(commentContent.trim()),
                    turnstileToken
                })
            });

            const result = await res.json();

            if (!res.ok) {
                const apiMessage =
                    typeof result?.error?.message === 'string' ? result.error.message
                    : typeof result?.message === 'string' ? result.message
                    : 'Failed to submit comment';
                throw new Error(apiMessage);
            }

            if (result.is_approved) {
                addedComments = [...addedComments, result.comment];
                feedbackMessage = {
                    type: 'success',
                    text: parentId ? 'Your reply has been posted.' : 'Your comment has been posted.'
                };
                commentContent = '';
                authorName = '';
                valid = { authorName: false, commentContent: false };
                validation.reset();
                errors = { authorName: '', commentContent: '' };
                replyTo = null;
            } else {
                feedbackMessage = {
                    type: 'error',
                    text: 'Your comment was blocked by AI content moderation (flagged as inappropriate).'
                };
            }
        } catch (err) {
            const error = err as Error;
            feedbackMessage = {
                type: 'error',
                text: error.message || 'An error occurred while posting your comment.'
            };
        } finally {
            isSubmitting = false;
            resetTurnstile(turnstileEl);
        }
    }

    let siteUrl = $derived((author?.siteUrl || page.url.origin).replace(/\/$/, ''));

    let jsonLdScript = $derived(
        '<script type="application/ld+json">'
            + JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'BlogPosting',
                headline: post.title,
                description: post.excerpt || post.title,
                url: siteUrl + '/blog/' + post.slug,
                datePublished: post.created_at,
                author: { '@type': 'Person', name: author?.name || '', url: siteUrl }
            }).replace(/</g, '\\u003c')
            + '</'
            + 'script>'
    );

    function handleCollaboratorsWindowPointerDown(event: PointerEvent) {
        if (
            isCollaboratorsPopoverOpen
            && collaboratorsContainerRef
            && !collaboratorsContainerRef.contains(event.target as Node)
        ) {
            isCollaboratorsPopoverOpen = false;
        }
    }

    function handleCollaboratorsKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape' && isCollaboratorsPopoverOpen) {
            event.preventDefault();
            isCollaboratorsPopoverOpen = false;
        }
    }
</script>

<svelte:window
    onpointerdown={handleCollaboratorsWindowPointerDown}
    onkeydown={handleCollaboratorsKeydown} />

<svelte:body onclick={handleArticleLinkClick} />

<svelte:head>
    <title>{post.title}{author?.name ? ` | ${author.name}` : ''}</title>
    <script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        async
        defer></script>
    {#if post.excerpt}
        <meta
            name="description"
            content={post.excerpt} />
    {/if}
    <link
        rel="canonical"
        href={siteUrl + '/blog/' + post.slug} />
    {@html jsonLdScript}

    <meta
        property="og:type"
        content="article" />
    <meta
        property="og:locale"
        content="en_US" />
    <meta
        property="og:url"
        content={siteUrl + '/blog/' + post.slug} />
    <meta
        property="og:title"
        content={post.title} />
    {#if post.excerpt}
        <meta
            property="og:description"
            content={post.excerpt} />
    {/if}
    {#if bannerSocialUrl}
        <meta
            property="og:image"
            content={bannerSocialUrl} />
        <meta
            property="og:image:secure_url"
            content={bannerSocialUrl} />
    {/if}
    <meta
        property="og:image:alt"
        content={post.title} />

    <meta
        name="twitter:card"
        content="summary_large_image" />
    <meta
        property="twitter:card"
        content="summary_large_image" />
    <meta
        property="twitter:url"
        content={siteUrl + '/blog/' + post.slug} />
    <meta
        property="twitter:title"
        content={post.title} />
    {#if post.excerpt}
        <meta
            property="twitter:description"
            content={post.excerpt} />
    {/if}
    {#if bannerSocialUrl}
        <meta
            name="twitter:image"
            content={bannerSocialUrl} />
        <meta
            property="twitter:image"
            content={bannerSocialUrl} />
    {/if}
</svelte:head>

{#if !readingModeStore.active}
    <TopNav
        ariaLabel="Article navigation"
        backHref="/blog"
        backLabel="Blog"
        showFontSelect={true}
        projects={data.projects}
        readingMode={readingModeStore.active}
        onToggleReadingMode={readingModeStore.toggle} />
{/if}

<main
    id="main-content"
    class="blog-reading-page flex flex-col font-sans {readingModeStore.active ?
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
                banner={bannerPublicUrl}
                bannerAlt={blogBannerAlt(post.title, post.excerpt)}
                title={post.title}
                titleClass="text-text-primary"
                titleViewTransitionName="post-title-{post.slug}">
                {#snippet meta()}
                    <div class="relative flex items-center gap-2.5 select-none">
                        <div
                            class="flex shrink-0 flex-row items-center -space-x-3 overflow-visible">
                            {#each visibleAvatarAuthors as user, idx (user)}
                                <a
                                    href="https://github.com/{user}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="relative inline-block transition-transform hover:z-40 hover:scale-110 focus-visible:outline-none"
                                    style="z-index: {30 - idx * 10};"
                                    aria-label="{user}'s GitHub profile">
                                    <Avatar
                                        name={user}
                                        src={`https://github.com/${user}.png?size=128`}
                                        class="size-5" />
                                </a>
                            {/each}
                        </div>

                        <div
                            class="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-text-secondary">
                            <span>Authored by</span>
                            {#if allAuthors.length === 1}
                                <a
                                    href="https://github.com/{allAuthors[0]}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline">
                                    {allAuthors[0]}
                                </a>
                            {:else if allAuthors.length === 2}
                                <a
                                    href="https://github.com/{allAuthors[0]}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline">
                                    {allAuthors[0]}
                                </a>
                                <span>and</span>
                                <a
                                    href="https://github.com/{allAuthors[1]}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline">
                                    {allAuthors[1]}
                                </a>
                            {:else if allAuthors.length === 3}
                                <span class="inline-flex items-center">
                                    <a
                                        href="https://github.com/{allAuthors[0]}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline"
                                        >{allAuthors[0]}</a
                                    >,
                                </span>
                                <span class="inline-flex items-center">
                                    <a
                                        href="https://github.com/{allAuthors[1]}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline"
                                        >{allAuthors[1]}</a
                                    >,
                                </span>
                                <span>and</span>
                                <a
                                    href="https://github.com/{allAuthors[2]}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline">
                                    {allAuthors[2]}
                                </a>
                            {:else}
                                <span class="inline-flex items-center">
                                    <a
                                        href="https://github.com/{allAuthors[0]}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline"
                                        >{allAuthors[0]}</a
                                    >,
                                </span>
                                <span class="inline-flex items-center">
                                    <a
                                        href="https://github.com/{allAuthors[1]}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline"
                                        >{allAuthors[1]}</a
                                    >,
                                </span>
                                <span class="inline-flex items-center">
                                    <a
                                        href="https://github.com/{allAuthors[2]}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline"
                                        >{allAuthors[2]}</a
                                    >,
                                </span>
                                <span>and</span>
                                <div
                                    bind:this={collaboratorsContainerRef}
                                    class="relative inline-block">
                                    <button
                                        type="button"
                                        aria-expanded={isCollaboratorsPopoverOpen}
                                        aria-haspopup="dialog"
                                        class="cursor-pointer font-semibold text-text-primary underline-offset-4 transition-colors hover:text-accent hover:underline"
                                        onclick={() => {
                                            isCollaboratorsPopoverOpen =
                                                !isCollaboratorsPopoverOpen;
                                        }}>
                                        {hiddenCollaborators.length} other{(
                                            hiddenCollaborators.length > 1
                                        ) ?
                                            's'
                                        :   ''}
                                    </button>

                                    {#if isCollaboratorsPopoverOpen}
                                        <div
                                            role="dialog"
                                            aria-label="Other collaborators"
                                            class="absolute top-full right-0 z-50 mt-2 flex w-max max-w-[calc(100vw-2.5rem)] min-w-36 flex-col gap-0.5 rounded-md border border-border-subtle bg-surface-elevated p-1.5 shadow-lg sm:right-auto sm:left-0">
                                            <span
                                                class="px-1.5 py-0.5 text-2xs font-semibold tracking-wider text-text-muted uppercase">
                                                {hiddenCollaborators.length > 1 ?
                                                    'Other collaborators'
                                                :   'Other collaborator'}
                                            </span>
                                            {#each hiddenCollaborators as collab (collab)}
                                                <a
                                                    href="https://github.com/{collab}"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onclick={() =>
                                                        (isCollaboratorsPopoverOpen = false)}
                                                    class="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-surface-hover hover:text-accent">
                                                    <Avatar
                                                        name={collab}
                                                        src={`https://github.com/${collab}.png?size=128`}
                                                        class="size-5" />
                                                    <span
                                                        class="font-semibold text-text-primary hover:underline"
                                                        >{collab}</span>
                                                </a>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <ArticleMeta
                        loading={isNavigatingToBlogPost}
                        layout="single"
                        date={post.created_at}
                        updatedAt={post.updated_at}
                        readingTime={formatReadTime(post.read_time)}
                        commentsCount={comments.length}
                        views={viewCount !== null ? viewCount : undefined}
                        class="mt-3 w-full" />

                    {#if !readingModeStore.active}
                        <div
                            transition:fade={{ duration: 150 }}
                            class="w-full lg:hidden">
                            <ContentActions
                                class="mt-3 w-full"
                                slug={post.slug}
                                pageId={post.id}
                                title={post.title}
                                viewMarkdownUrl="/blog/{post.slug}.md"
                                viewTextUrl="/blog/{post.slug}.txt" />
                        </div>
                    {/if}
                {/snippet}
            </ArticleHeader>

            {#if !readingModeStore.active && ((post.tldr && post.tldr.length > 0) || post.summary)}
                <div
                    transition:fade={{ duration: 150 }}
                    class="mt-3 lg:hidden">
                    <PostInsights
                        tldr={post.tldr}
                        summary={post.summary}
                        class="mt-0!" />
                </div>
            {/if}

            {#if !readingModeStore.active}
                <div
                    transition:fade={{ duration: 150 }}
                    class="mt-3 flex flex-col lg:hidden">
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
                <HelpfulBlock
                    class="mt-6 sm:mt-8"
                    voted={feedback.voted}
                    pending={feedback.pending}
                    error={feedback.error}
                    onVote={helpful => feedback.vote(helpful ? 'yes' : 'no')}
                    onFeedbackClick={() => (showNoFeedbackDialog = true)} />

                <SubscribeForm class="mt-6 sm:mt-8" />

                {#if relatedPosts.length > 0}
                    <section
                        class="mt-6 border-t border-border-subtle pt-4 sm:mt-8 sm:pt-6"
                        aria-label="Related posts">
                        <h3 class="mb-3 text-sm font-bold tracking-tight text-text-primary">
                            Continue reading
                        </h3>
                        <div class="relative z-0 grid grid-cols-1 gap-3 sm:gap-4">
                            {#each relatedPosts as related (related.id)}
                                {@const relatedScope = `related-${related.id}`}
                                <div use:focusScope={relatedScope}>
                                    <Card
                                        density="none"
                                        class="relative flex flex-col border-0! text-left dark:border-0!">
                                        <div
                                            class="relative aspect-2/1 w-full shrink-0 overflow-hidden rounded-t-md">
                                            {#if related.bannerPublicUrl && !failedRelatedBanners.has(related.id)}
                                                <ImageWithSkeleton
                                                    src={related.bannerPublicUrl}
                                                    alt={blogBannerAlt(
                                                        related.title,
                                                        related.excerpt
                                                    )}
                                                    rounded=""
                                                    onerror={() =>
                                                        markRelatedBannerFailed(related.id)}
                                                    class="h-full w-full object-cover" />
                                            {:else}
                                                <div
                                                    class="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 to-accent/5 select-none">
                                                    <ImageIcon class="size-10 text-text-muted" />
                                                </div>
                                            {/if}
                                        </div>

                                        <div
                                            class="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3 font-sans sm:gap-2.5 sm:p-4">
                                            <div class="flex flex-col gap-1.5 sm:gap-2">
                                                <div>
                                                    <h4
                                                        style="view-transition-name: post-title-{related.slug}"
                                                        class="line-clamp-2 text-xl leading-snug font-bold text-text-primary">
                                                        {related.title}
                                                        {#if related.pinned || isPostNew(related)}
                                                            <span
                                                                class="inline-flex items-center gap-1 align-middle select-none">
                                                                {#if related.pinned}
                                                                    <span
                                                                        class="inline-flex size-4.5 items-center justify-center rounded-full bg-success-subtle text-success"
                                                                        title="Pinned post"
                                                                        aria-label="Pinned post">
                                                                        <Pin
                                                                            class="size-3 shrink-0" />
                                                                    </span>
                                                                {/if}
                                                                {#if isPostNew(related)}
                                                                    <span
                                                                        class="inline-flex size-4.5 items-center justify-center rounded-full bg-security-subtle text-security"
                                                                        title="New post"
                                                                        aria-label="New post">
                                                                        <Sparkles
                                                                            class="size-3 shrink-0" />
                                                                    </span>
                                                                {/if}
                                                            </span>
                                                        {/if}
                                                    </h4>
                                                </div>

                                                <ArticleMeta
                                                    size="xs"
                                                    layout="single"
                                                    class="min-h-4.5"
                                                    date={related.created_at || ''}
                                                    updatedAt={related.updated_at || ''}
                                                    readingTime={formatReadTime(related.read_time)}
                                                    commentsCount={related.comment_count}
                                                    views={related.views_count} />

                                                {#if related.excerpt}
                                                    {@const isExpanded = expandedExcerptIds.has(
                                                        related.id
                                                    )}
                                                    {@const isOverflowing =
                                                        overflowingExcerptIds.has(related.id)}
                                                    <div class="flex flex-col items-start gap-1">
                                                        <p
                                                            {@attach !isExpanded
                                                                && observeExcerptOverflow(
                                                                    related.id
                                                                )}
                                                            class="text-xs leading-relaxed text-text-secondary sm:text-sm {(
                                                                isExpanded
                                                            ) ?
                                                                ''
                                                            :   'line-clamp-2'}">
                                                            {related.excerpt}
                                                            {#if isOverflowing && isExpanded}
                                                                <Button
                                                                    type="ghost"
                                                                    size="2xs"
                                                                    htmlType="button"
                                                                    onclick={() =>
                                                                        toggleExcerpt(related.id)}
                                                                    keyboardShortcut="E"
                                                                    shortcutLabel="Show less"
                                                                    class="relative inline-flex h-auto! min-h-0! p-0! text-xs font-normal whitespace-nowrap text-security! underline hover:opacity-80 focus-visible:outline-none">
                                                                    Show less
                                                                </Button>
                                                            {/if}
                                                        </p>
                                                        {#if isOverflowing && !isExpanded}
                                                            <Button
                                                                type="ghost"
                                                                size="2xs"
                                                                htmlType="button"
                                                                onclick={() =>
                                                                    toggleExcerpt(related.id)}
                                                                keyboardShortcut="E"
                                                                shortcutLabel="Show more"
                                                                class="relative inline-flex h-auto! min-h-0! p-0! text-xs font-normal whitespace-nowrap text-security! underline hover:opacity-80 focus-visible:outline-none">
                                                                Show more
                                                            </Button>
                                                        {/if}
                                                    </div>
                                                {/if}

                                                {#if related.tags && related.tags.length > 0}
                                                    <div
                                                        class="relative z-20 flex flex-wrap items-center gap-1.5 pt-0.5">
                                                        {#each related.tags as tag (tag)}
                                                            <Tag
                                                                variant="accent"
                                                                class="font-mono"
                                                                >{decodeHtmlEntities(tag)}</Tag>
                                                        {/each}
                                                    </div>
                                                {/if}
                                            </div>

                                            <div
                                                class="relative z-20 mt-auto flex flex-col gap-2 pt-1">
                                                <hr class="border-border-subtle/25" />
                                                <Button
                                                    href="/blog/{related.slug}"
                                                    type="primary"
                                                    size="sm"
                                                    shortcutGroup="posts"
                                                    shortcutLabel={related.title}
                                                    fullWidth>
                                                    Read post
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            {/each}
                        </div>
                    </section>
                {/if}

                <section
                    class="mt-8 border-t border-border-subtle pt-6 sm:mt-10 sm:pt-8"
                    aria-label="Comments">
                    <h2
                        class="mb-5 text-lg font-bold tracking-tight text-text-primary sm:mb-6 sm:text-xl">
                        Comments ({comments.length})
                    </h2>

                    {#if feedbackMessage}
                        <StatusBanner
                            variant={feedbackMessage.type === 'success' ? 'success' : 'error'}
                            message={feedbackMessage.text}
                            class="mb-6" />
                    {/if}

                    {#if !replyTo}
                        <div
                            class="mb-6 rounded-md border border-border-subtle bg-surface-card/75 p-3.5 text-left shadow-2xs sm:p-4">
                            <form
                                novalidate
                                onsubmit={e => handleSubmit(e)}
                                class="flex flex-col gap-3">
                                <FormField
                                    id="comment-author"
                                    label="Name"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    maxlength={50}
                                    currentLength={authorName.length}
                                    error={errors.authorName}
                                    valid={valid.authorName}>
                                    <Input
                                        type="text"
                                        id="comment-author"
                                        autocomplete="name"
                                        aria-invalid={!!errors.authorName}
                                        maxlength={50}
                                        bind:value={authorName}
                                        error={!!errors.authorName}
                                        valid={valid.authorName}
                                        oninput={() => {
                                            errors.authorName = '';
                                            valid.authorName = false;
                                            queueMicrotask(() => validation.input('authorName'));
                                        }}
                                        onblur={() => {
                                            void validation.check('authorName');
                                        }} />
                                </FormField>

                                <FormField
                                    id="comment-msg"
                                    label="Message"
                                    variant="floating"
                                    required
                                    hideAsterisk
                                    maxlength={2000}
                                    currentLength={commentContent.length}
                                    counter={`${commentContent.length}/2000`}
                                    error={errors.commentContent}
                                    valid={valid.commentContent}>
                                    <Textarea
                                        id="comment-msg"
                                        rows={4}
                                        maxlength={2000}
                                        bind:value={commentContent}
                                        error={!!errors.commentContent}
                                        valid={valid.commentContent}
                                        oninput={() => {
                                            errors.commentContent = '';
                                            valid.commentContent = false;
                                            queueMicrotask(() =>
                                                validation.input('commentContent')
                                            );
                                        }}
                                        aria-required="true"
                                        onblur={() => {
                                            void validation.check('commentContent');
                                        }} />
                                </FormField>

                                <div
                                    bind:this={turnstileEl}
                                    class="cf-turnstile select-none"
                                    data-sitekey={turnstileSiteKey}
                                    data-action="blog-comment"
                                    data-size="flexible"
                                    data-theme="auto"
                                    data-appearance="interaction-only"
                                    data-execution="execute"
                                    use:turnstileWidget={{
                                        sitekey: turnstileSiteKey,
                                        size: 'flexible',
                                        action: 'blog-comment',
                                        theme: 'auto',
                                        appearance: 'interaction-only',
                                        execution: 'execute'
                                    }}>
                                </div>

                                <ConsentNotice action="posting a comment" />

                                <div
                                    class="mt-1 flex items-center justify-between gap-2 select-none">
                                    <Button
                                        htmlType="button"
                                        type="outline"
                                        tone="critical"
                                        size="md"
                                        class="flex-1 sm:flex-initial"
                                        disabled={!canClearComment || isSubmitting}
                                        keyboardShortcut={buttonKey('formClear')}
                                        shortcutLabel="Clear comment"
                                        onclick={clearCommentForm}>
                                        <span
                                            >Clear<span class="hidden sm:inline">&nbsp;comment</span
                                            ></span>
                                    </Button>
                                    <Button
                                        htmlType="submit"
                                        type="primary"
                                        size="md"
                                        class="flex-1 sm:flex-initial"
                                        aria-keyshortcuts="Control+Enter Meta+Enter"
                                        disabled={isSubmitting}
                                        isLoading={isSubmitting}
                                        keyboardShortcut={buttonKey('formSubmit')}
                                        shortcutLabel="Post comment">
                                        {isSubmitting ? 'Posting…' : 'Post comment'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    {/if}

                    {#if comments.length === 0}
                        <EmptyState
                            title="No comments yet"
                            description="Be the first to share your thoughts on this article." />
                    {:else}
                        <CommentThread
                            {comments}
                            {replyTo}
                            pageSize={COMMENTS_PAGE_SIZE}
                            controls
                            useContentFont={true}
                            authorName={author?.name || ''}
                            onReport={comment => {
                                reportingComment = comment;
                                showReportDialog = true;
                            }}>
                            {#snippet actions(comment)}
                                <RelativeTime
                                    date={comment.created_at}
                                    tag="time" />
                                <button
                                    type="button"
                                    onclick={() => {
                                        replyTo = comment;
                                        feedbackMessage = null;
                                        commentContent = '';
                                    }}
                                    use:shortcut={{
                                        combo: 'R',
                                        scope: `comment-${comment.id}`,
                                        label: 'Reply'
                                    }}
                                    class="relative cursor-pointer font-bold text-text-muted transition-colors hover:text-accent focus-visible:outline-none">
                                    Reply
                                </button>
                            {/snippet}

                            {#snippet replyForm(comment)}
                                <form
                                    novalidate
                                    onsubmit={e => handleSubmit(e, comment.id)}
                                    class="mb-3 rounded-md border border-border-subtle bg-surface-base/80 p-3.5 text-left shadow-2xs sm:p-4">
                                    <div
                                        class="mb-3 flex items-center justify-between gap-3 border-b border-border-subtle/50 pb-2.5">
                                        <p class="text-xs font-semibold text-text-secondary">
                                            Replying to {getCommentAuthor(comment)}
                                        </p>
                                        <Button
                                            type="ghost"
                                            size="sm"
                                            keyboardShortcut={buttonKey('formClear')}
                                            shortcutLabel="Cancel reply"
                                            onclick={cancelReply}>Cancel</Button>
                                    </div>

                                    <div class="flex flex-col gap-3">
                                        <FormField
                                            id="reply-author-{comment.id}"
                                            label="Name"
                                            variant="floating"
                                            required
                                            hideAsterisk
                                            maxlength={50}
                                            currentLength={authorName.length}
                                            error={errors.authorName}
                                            valid={valid.authorName}>
                                            <Input
                                                type="text"
                                                id="reply-author-{comment.id}"
                                                autocomplete="name"
                                                aria-invalid={!!errors.authorName}
                                                maxlength={50}
                                                bind:value={authorName}
                                                error={!!errors.authorName}
                                                valid={valid.authorName}
                                                oninput={() => {
                                                    errors.authorName = '';
                                                    valid.authorName = false;
                                                    queueMicrotask(() =>
                                                        validation.input('authorName')
                                                    );
                                                }}
                                                onblur={() => {
                                                    void validation.check('authorName');
                                                }} />
                                        </FormField>

                                        <FormField
                                            id="reply-msg-{comment.id}"
                                            label="Message"
                                            variant="floating"
                                            required
                                            hideAsterisk
                                            maxlength={2000}
                                            currentLength={commentContent.length}
                                            counter={`${commentContent.length}/2000`}
                                            error={errors.commentContent}
                                            valid={valid.commentContent}>
                                            <Textarea
                                                id="reply-msg-{comment.id}"
                                                rows={3}
                                                maxlength={2000}
                                                bind:value={commentContent}
                                                error={!!errors.commentContent}
                                                valid={valid.commentContent}
                                                oninput={() => {
                                                    errors.commentContent = '';
                                                    valid.commentContent = false;
                                                    queueMicrotask(() =>
                                                        validation.input('commentContent')
                                                    );
                                                }}
                                                aria-required="true"
                                                onblur={() => {
                                                    void validation.check('commentContent');
                                                }} />
                                        </FormField>

                                        <div
                                            bind:this={turnstileEl}
                                            class="cf-turnstile select-none"
                                            data-sitekey={turnstileSiteKey}
                                            data-action="blog-comment-reply"
                                            data-size="flexible"
                                            data-theme="auto"
                                            data-appearance="interaction-only"
                                            data-execution="execute"
                                            use:turnstileWidget={{
                                                sitekey: turnstileSiteKey,
                                                size: 'flexible',
                                                action: 'blog-comment-reply',
                                                theme: 'auto',
                                                appearance: 'interaction-only',
                                                execution: 'execute'
                                            }}>
                                        </div>

                                        <ConsentNotice action="posting a reply" />

                                        <div class="mt-1 flex items-center justify-end gap-3">
                                            <Button
                                                htmlType="submit"
                                                type="primary"
                                                size="sm"
                                                aria-keyshortcuts="Control+Enter Meta+Enter"
                                                disabled={isSubmitting}
                                                isLoading={isSubmitting}
                                                keyboardShortcut={buttonKey('formSubmit')}
                                                shortcutLabel="Post reply">
                                                {isSubmitting ? 'Posting…' : 'Post reply'}
                                            </Button>
                                        </div>
                                    </div>
                                </form>
                            {/snippet}
                        </CommentThread>
                    {/if}
                </section>

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
            {/if}
        </article>

        {#if !readingModeStore.active}
            <aside
                transition:fade={{ duration: 150 }}
                class="article-scroll-container hidden select-none lg:sticky lg:top-0 lg:z-20 lg:flex lg:max-h-full lg:w-full lg:flex-col lg:overflow-y-auto lg:px-3 lg:pt-[1.25vw] lg:pb-[1.25vw] [&>*+*]:lg:mt-4"
                aria-label="Article actions and insights">
                {#if post.tldr && post.tldr.length > 0}
                    <PostInsights
                        mode="tldr-only"
                        tldr={post.tldr}
                        class="w-full shrink-0" />
                {/if}

                {#if post.summary}
                    <PostInsights
                        mode="summary-only"
                        summary={post.summary}
                        class="w-full shrink-0" />
                {/if}

                <ContentActions
                    variant="sidebar"
                    class="w-full shrink-0"
                    slug={post.slug}
                    pageId={post.id}
                    title={post.title}
                    viewMarkdownUrl="/blog/{post.slug}.md"
                    viewTextUrl="/blog/{post.slug}.txt" />
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
                class="inline-flex size-8 cursor-pointer items-center justify-center rounded-full glass-button border border-accent/40 bg-surface-card/90 px-0 text-xs font-semibold text-accent shadow-md transition-all hover:scale-105 hover:border-accent hover:bg-surface-hover active:scale-95 md:shadow-lg"
                onclick={readingModeStore.toggle}
                use:shortcut={{ combo: buttonKey('readingMode'), label: 'Exit reading mode' }}
                aria-label="Exit reading mode">
                <BookOpenText class="size-4 shrink-0" />
            </button>
        </Tooltip>
    </div>
{/if}

<ReportCommentDialog
    bind:isOpen={showReportDialog}
    comment={reportingComment}
    onClose={() => {
        reportingComment = null;
    }} />

<ShareDialog
    bind:isOpen={showYesFeedbackDialog}
    title="Thanks for your feedback!"
    description="We're glad you found this article helpful! Feel free to share it with your network or colleagues."
    url={page.url.href}
    articleTitle={post.title}
    showEmail
    onOpenQr={() => {
        showQrDialog = true;
    }}
    onClose={() => {
        showYesFeedbackDialog = false;
    }} />

<QrCodeDialog
    bind:isOpen={showQrDialog}
    title={post.title}
    url={page.url.href}
    slug={post.slug}
    avatarUrl={author?.avatar ?? ''}
    onClose={() => (showQrDialog = false)} />

<Dialog
    bind:isOpen={showNoFeedbackDialog}
    title="Share your feedback?"
    description="Tell us what we can improve. Your report helps make this article better for everyone."
    onClose={() => {
        showNoFeedbackDialog = false;
    }}>
    {#snippet footer()}
        <div class="grid w-full grid-cols-2 gap-2.5">
            <Button
                type="secondary"
                size="md"
                fullWidth
                keyboardShortcut="C"
                shortcutLabel="Cancel"
                onclick={() => {
                    showNoFeedbackDialog = false;
                }}>Cancel</Button>
            <Button
                type="primary"
                size="md"
                fullWidth
                keyboardShortcut={buttonKey('formSubmit')}
                shortcutLabel="Send feedback"
                onclick={() => {
                    showNoFeedbackDialog = false;
                    window.location.href = '/feedback';
                }}>Send feedback</Button>
        </div>
    {/snippet}
</Dialog>
