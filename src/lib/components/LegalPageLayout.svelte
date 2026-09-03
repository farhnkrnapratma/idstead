<script lang="ts">
  import {tick, onMount} from 'svelte';
  import {RotateCcwClock} from '@lucide/svelte';
  import {
    TopNav,
    TableOfContents,
    HelpfulBlock,
    Toast,
    ContentActions,
    FooterSection,
    SkipLink
  } from '$lib';
  import ArticleHeader from '$lib/article/ArticleHeader.svelte';
  import AlertDialog from './AlertDialog.svelte';
  import {toastStore} from '$lib/stores/toastStore.svelte';
  import type {HeadingItem} from '$lib/markdown';
  import {formatAbsoluteDate} from '$lib/utils/formatters';
  import {enhanceMarkdownContent} from '$lib/utils/markdownEnhancer';
  import hljs from 'highlight.js';
  import 'katex/dist/katex.min.css';
  import {themeStore} from '$lib/stores/themeStore.svelte';
  import {a11yStore} from '$lib/stores/a11yStore.svelte';
  import {contentFontStore} from '$lib/stores/contentFontStore.svelte';
  import {pushState} from '$app/navigation';
  import {page} from '$app/state';

  interface Props {
    title: string;
    slug: string;
    content: string;
    html: string;
    headings: HeadingItem[];
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
    updatedAt,
    authorName = '',
    avatarUrl = '',
    siteUrl = ''
  }: Props = $props();

  let pageProjects = $derived((page?.data as any)?.projects ?? []);

  let showYesFeedbackDialog = $state(false);
  let showNoFeedbackDialog = $state(false);
  let isDark = $state(false);

  function triggerToast(message: string, isError = false) {
    if (isError) {
      toastStore.error(message);
    } else {
      toastStore.success(message);
    }
  }

  function handleHelpfulness(value: 'yes' | 'no') {
    if (value === 'yes') {
      showYesFeedbackDialog = true;
    } else {
      showNoFeedbackDialog = true;
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

<TopNav
  ariaLabel="{title} navigation"
  backHref="/"
  backLabel="Back to Home"
  showFontSelect={true}
  projects={pageProjects} />

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3rem)] flex-col pt-12 font-sans sm:min-h-[calc(100vh-3.5rem)] sm:pt-14">
  <div
    class="relative mx-auto w-full px-6 pt-3 pb-16 sm:pt-4 md:w-[80%] lg:w-[65%] xl:w-[55%]">
    <aside
      class="sticky top-18 hidden max-h-[calc(100dvh-9.5rem)] flex-col gap-3 self-start select-none xl:float-left xl:-ml-64 xl:flex xl:w-56"
      aria-label="Table of contents">
      <TableOfContents
        {headings}
        class="max-h-[calc(100dvh-15.5rem)] min-h-0 flex-1" />
      <HelpfulBlock
        onVote={helpful => handleHelpfulness(helpful ? 'yes' : 'no')} />
    </aside>

    <article class="flex w-full flex-col">
      <ArticleHeader {title}>
        {#snippet meta()}
          <div class="flex flex-col gap-2.5">
            <span
              class="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-text-secondary">
              <RotateCcwClock class="size-3.5 shrink-0 text-text-muted" />
              {#if updatedAt}
                <span>Updated {formatAbsoluteDate(updatedAt)}</span>
              {:else}
                <span>Official Policy</span>
              {/if}
            </span>

            <ContentActions
              class="w-full"
              {slug}
              {title}
              {avatarUrl}
              markdownContent={content}
              viewMarkdownUrl="/api/internal/raw?type=legal&slug={slug}&format=md"
              viewTextUrl="/api/internal/raw?type=legal&slug={slug}&format=text"
              pageUrl={siteUrl ? `${siteUrl}/${slug}` : undefined} />
          </div>
        {/snippet}
      </ArticleHeader>

      <div class="mt-3 flex flex-col xl:hidden">
        <TableOfContents
          {headings}
          collapsible={true}
          defaultCollapsed={true} />
      </div>

      <div
        class="prose-custom font-content-{contentFontStore.current} mt-4 w-full">
        {@html html}
      </div>

      <div class="mt-8 border-t border-border-subtle pt-6 xl:hidden">
        <HelpfulBlock
          onVote={helpful => handleHelpfulness(helpful ? 'yes' : 'no')} />
      </div>
    </article>
  </div>

  <FooterSection showFontSelect={true} />
</main>

<Toast />

<AlertDialog
  isOpen={showYesFeedbackDialog}
  title="Thank You!"
  description="Your feedback has been recorded. We appreciate your input!"
  onClose={() => (showYesFeedbackDialog = false)} />

<AlertDialog
  isOpen={showNoFeedbackDialog}
  title="Thank You for Your Feedback"
  description="We appreciate your input. We will work to improve this page."
  onClose={() => (showNoFeedbackDialog = false)} />
