<script lang="ts">
  import {createFeedbackClient} from '$lib/feedbackClient.svelte';
  import {tick, onMount} from 'svelte';
  import {fade} from 'svelte/transition';
  import {BookOpenText} from '@lucide/svelte';
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
  } from '$lib';
  import ArticleHeader from '$lib/article/ArticleHeader.svelte';
  import ArticleMeta from '$lib/article/ArticleMeta.svelte';
  import {toastStore} from '$lib/stores/toastStore.svelte';
  import {readingModeStore} from '$lib/stores/readingModeStore.svelte';
  import type {HeadingItem} from '$lib/markdown';
  import {formatReadTime} from '$lib/utils/formatters';
  import {countReadingMinutes} from '$lib/readTime';
  import {enhanceMarkdownContent} from '$lib/utils/markdownEnhancer';
  import hljs from 'highlight.js';
  import 'katex/dist/katex.min.css';
  import {contentFontStore} from '$lib/stores/contentFontStore.svelte';
  import {pushState, goto} from '$app/navigation';
  import {page} from '$app/state';

  interface Props {
    title: string;
    slug: string;
    content: string;
    html: string;
    headings: HeadingItem[];
    date?: string;
    updatedAt?: string;
    authorName?: string;
    avatarUrl?: string;
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
    avatarUrl = '',
    siteUrl = ''
  }: Props = $props();

  let pageProjects = $derived((page?.data as any)?.projects ?? []);

  const feedback = createFeedbackClient(() => ({type: 'legal', id: slug}));
  let isDark = $state(false);

  const estimatedMinutes = $derived(content ? countReadingMinutes(content) : 1);
  const readingTime = $derived(formatReadTime(estimatedMinutes));

  let articleScrollTop = $state(0);
  let articleScrollHeight = $state(0);
  let articleClientHeight = $state(0);

  const articleScrollProgress = $derived(
    articleScrollHeight - articleClientHeight > 0 ?
      (articleScrollTop / (articleScrollHeight - articleClientHeight)) * 100
    : 0
  );
  const isArticleScrolledPast = $derived(articleScrollTop > 300);

  function handleArticleScroll(e: Event) {
    const target = e.currentTarget as HTMLElement;
    articleScrollTop = target.scrollTop;
    articleScrollHeight = target.scrollHeight;
    articleClientHeight = target.clientHeight;
  }

  let articleBodyEl: HTMLElement | undefined = $state();

  function scrollArticleToTop() {
    if (articleBodyEl) {
      const container = articleBodyEl.closest(
        '.article-scroll-container'
      ) as HTMLElement | null;
      if (container) {
        container.scrollTo({top: 0, behavior: 'smooth'});
        return;
      }
    }
    window.scrollTo({top: 0, behavior: 'smooth'});
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
      const container = document.querySelector('.prose-custom');
      if (container) {
        const blocks = container.querySelectorAll('pre code');
        blocks.forEach(block => {
          hljs.highlightElement(block as HTMLElement);
        });
        enhanceMarkdownContent({container, isDark, onCodeCopy: triggerToast});
        const elements = Array.from(
          container.querySelectorAll('h1, h2, h3, h4, h5, h6')
        ).filter(
          el =>
            !el.closest('.markdown-chart-container')
            && !el.closest('.mermaid-block')
        ) as HTMLElement[];
        if (elements.length === 0) return;

        elements.forEach(el => {
          el.classList.add('group', 'scroll-mt-20', 'cursor-pointer');

          const existingAnchor = el.querySelector('.anchor-link');
          if (existingAnchor) {
            existingAnchor.remove();
          }

          let headingText = el.querySelector(
            '.heading-text'
          ) as HTMLElement | null;
          if (!headingText) {
            headingText = document.createElement('span');
            headingText.className = 'heading-text';
            while (el.firstChild) {
              headingText.appendChild(el.firstChild);
            }
            el.appendChild(headingText);
          }

          const anchor = document.createElement('a');
          anchor.href = `#${el.id}`;
          anchor.className = 'anchor-link select-none';
          anchor.tabIndex = -1;
          anchor.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link-2 size-[0.75em] leading-none inline-block align-middle select-none opacity-0" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>';

          const walker = document.createTreeWalker(
            headingText,
            NodeFilter.SHOW_TEXT
          );
          let lastTextNode: Text | null = null;
          let node: Node | null;
          while ((node = walker.nextNode())) {
            if (node.nodeValue && node.nodeValue.trim().length > 0) {
              lastTextNode = node as Text;
            }
          }

          if (lastTextNode && lastTextNode.nodeValue) {
            const val = lastTextNode.nodeValue;
            const match = val.match(/^(.*?)(\s+)?(\S+)(\s*)$/);
            if (match) {
              const [, before, space, lastWord, trailingSpace] = match;
              const wrapSpan = document.createElement('span');
              wrapSpan.className = 'whitespace-nowrap';
              wrapSpan.textContent = lastWord;
              wrapSpan.appendChild(anchor);

              const parent = lastTextNode.parentNode;
              if (parent) {
                if (before) {
                  parent.insertBefore(
                    document.createTextNode(before + (space || '')),
                    lastTextNode
                  );
                }
                parent.insertBefore(wrapSpan, lastTextNode);
                if (trailingSpace) {
                  parent.insertBefore(
                    document.createTextNode(trailingSpace),
                    lastTextNode
                  );
                }
                parent.removeChild(lastTextNode);
              }
            } else {
              headingText.appendChild(anchor);
            }
          } else {
            headingText.appendChild(anchor);
          }

          el.onclick = async e => {
            e.preventDefault();
            const url = `${window.location.origin}${window.location.pathname}#${el.id}`;
            try {
              await navigator.clipboard.writeText(url);
              triggerToast('Link copied to clipboard');
            } catch {}
            const target = document.getElementById(el.id);
            if (target) {
              target.scrollIntoView({behavior: 'smooth', block: 'start'});
              pushState(`#${el.id}`, {});
            }
          };
        });
      }
    });
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

    return () => {
      observer.disconnect();
      readingModeStore.disable();
    };
  });
</script>

<svelte:head>
  <title>{title}{authorName ? ` — ${authorName}` : ''}</title>
  <meta
    name="description"
    content="{title}{authorName ?
      ` for ${authorName} portfolio and services.`
    : ''}" />
  {#if siteUrl}
    <link
      rel="canonical"
      href="{siteUrl}/{slug}" />
  {/if}
</svelte:head>

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
  : 'min-h-[calc(100vh-3rem)] overscroll-none pt-12 sm:min-h-[calc(100vh-3.5rem)] sm:pt-14 lg:h-dvh lg:min-h-0 lg:overflow-clip'}">
  <div
    class={readingModeStore.active ?
      'relative mx-auto w-full px-3 pt-3 pb-16 sm:px-6 sm:pt-4 md:w-[80%] lg:w-[50%]'
    : 'relative mx-auto w-full px-3 pt-5 pb-16 sm:px-6 sm:pt-6 md:w-[80%] md:pt-8 lg:mx-0 lg:grid lg:h-full lg:w-full lg:max-w-none lg:grid-cols-[25%_50%_25%] lg:grid-rows-[minmax(0,1fr)] lg:items-start lg:gap-0 lg:px-0 lg:pt-0 lg:pb-0'}>
    {#if !readingModeStore.active}
      <aside
        transition:fade={{duration: 150}}
        class="hidden select-none lg:sticky lg:top-0 lg:z-20 lg:flex lg:max-h-full lg:w-full lg:flex-col lg:overflow-hidden lg:px-3 lg:pt-[1.25vw] lg:pb-[1.25vw] [&>*+*]:lg:mt-4"
        aria-label="Table of contents">
        <TableOfContents
          {headings}
          class="min-h-0 w-full flex-1 [scrollbar-width:none] overflow-hidden [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" />
      </aside>
    {/if}

    <article
      bind:this={articleBodyEl}
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
              transition:fade={{duration: 150}}
              class="w-full lg:hidden">
              <ContentActions
                class="mt-3 w-full"
                {slug}
                {title}
                {avatarUrl}
                markdownContent={content}
                showCopyUrl={false}
                viewMarkdownUrl="/api/internal/raw?type=legal&slug={slug}&format=md"
                viewTextUrl="/api/internal/raw?type=legal&slug={slug}&format=text"
                pageUrl={siteUrl ? `${siteUrl}/${slug}` : undefined} />
            </div>
          {/if}
        {/snippet}
      </ArticleHeader>

      {#if !readingModeStore.active}
        <div class="mt-3 flex flex-col lg:hidden">
          <TableOfContents
            {headings}
            collapsible={true}
            defaultCollapsed={true} />
        </div>
      {/if}

      <div
        class="prose-custom font-content-{contentFontStore.current} mt-4 w-full">
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
        transition:fade={{duration: 150}}
        class="article-scroll-container hidden select-none lg:sticky lg:top-0 lg:z-20 lg:flex lg:max-h-full lg:w-full lg:flex-col lg:overflow-y-auto lg:px-3 lg:pt-[1.25vw] lg:pb-[1.25vw] [&>*+*]:lg:mt-4"
        aria-label="Article actions">
        <ContentActions
          variant="sidebar"
          class="w-full shrink-0"
          {slug}
          {title}
          {avatarUrl}
          markdownContent={content}
          showCopyUrl={false}
          viewMarkdownUrl="/api/internal/raw?type=legal&slug={slug}&format=md"
          viewTextUrl="/api/internal/raw?type=legal&slug={slug}&format=text"
          pageUrl={siteUrl ? `${siteUrl}/${slug}` : undefined} />
      </aside>
    {/if}
  </div>
</main>

<FeedbackButton
  show={!readingModeStore.active}
  class="hidden lg:fixed lg:bottom-6 lg:left-[calc(25%+0.75rem)] lg:z-40 lg:block" />

<ScrollToTopButton
  show={isArticleScrolledPast && !readingModeStore.active}
  onClick={scrollArticleToTop}
  progress={articleScrollProgress}
  class="hidden lg:fixed lg:right-[calc(25%+0.75rem)] lg:bottom-6 lg:z-40 lg:block" />

{#if readingModeStore.active}
  <div
    transition:fade={{duration: 150}}
    class="fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 md:right-6 md:bottom-6 lg:right-[calc(25%+0.75rem)]">
    <Tooltip
      content="Exit reading mode"
      placement="top"
      align="right">
      <button
        type="button"
        class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full glass-button border border-accent/40 bg-surface-card/90 px-0 text-xs font-semibold text-accent shadow-md transition-all hover:scale-105 hover:border-accent hover:bg-surface-hover active:scale-95 md:h-10 md:w-10 md:shadow-lg"
        onclick={readingModeStore.toggle}
        aria-label="Exit reading mode">
        <BookOpenText class="size-4.5 shrink-0 md:size-5" />
      </button>
    </Tooltip>
  </div>
{/if}

<Toast />
