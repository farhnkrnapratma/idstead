<script lang="ts">
  import {onMount, tick} from 'svelte';
  import {Copy, Link2 as LinkIcon} from '@lucide/svelte';
  import {
    TopNav,
    Breadcrumb,
    TableOfContents,
    HelpfulBlock,
    Toast,
    DropdownTrigger,
    FooterSection,
    SkipLink
  } from '$lib';
  import ArticleHeader from '$lib/article/ArticleHeader.svelte';
  import AlertDialog from './AlertDialog.svelte';
  import {toastStore} from '$lib/stores/toastStore.svelte';
  import type {HeadingItem} from '$lib/markdown';
  import {formatAbsoluteDate} from '$lib/utils/formatters';
  import {enhanceCodeBlocks} from '$lib/utils/codeBlocks';
  import hljs from 'highlight.js';
  import {themeStore} from '$lib/stores/themeStore.svelte';
  import {a11yStore} from '$lib/stores/a11yStore.svelte';
  import {contentFontStore} from '$lib/stores/contentFontStore.svelte';
  import {codeBlockPrefsStore} from '$lib/stores/codeBlockPrefsStore.svelte';
  import {resolveHljsTheme} from '$lib/utils/hljsTheme';
  import {pushState} from '$app/navigation';

  interface Props {
    title: string;
    slug: string;
    content: string;
    html: string;
    headings: HeadingItem[];
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
    updatedAt,
    authorName = '',
    siteUrl = ''
  }: Props = $props();

  let showCopyMenu = $state(false);
  let copyMenuRef: HTMLDivElement | undefined = $state();
  let showYesFeedbackDialog = $state(false);
  let showNoFeedbackDialog = $state(false);
  let isDark = $state(false);

  function handleWindowPointerDown(e: PointerEvent) {
    if (
      showCopyMenu
      && copyMenuRef
      && !copyMenuRef.contains(e.target as Node)
    ) {
      showCopyMenu = false;
    }
  }

  const hljsTheme = $derived(
    resolveHljsTheme(
      a11yStore.current.highContrast,
      isDark,
      codeBlockPrefsStore.current.colorScheme
    )
  );

  function triggerToast(message: string, isError = false) {
    if (isError) {
      toastStore.error(message);
    } else {
      toastStore.success(message);
    }
  }

  function toggleCopyMenu() {
    showCopyMenu = !showCopyMenu;
  }

  async function copyPageUrl() {
    showCopyMenu = false;
    try {
      const baseUrl =
        siteUrl
        || (typeof window !== 'undefined' ? window.location.origin : '');
      await navigator.clipboard.writeText(`${baseUrl}/${slug}`);
      triggerToast('Page URL copied to clipboard');
    } catch {
      triggerToast('Failed to copy URL', true);
    }
  }

  async function copyAsMarkdown() {
    showCopyMenu = false;
    try {
      await navigator.clipboard.writeText(content);
      triggerToast('Raw Markdown copied to clipboard');
    } catch {
      triggerToast('Failed to copy Markdown', true);
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

    tick().then(() => {
      const container = document.querySelector('.prose-custom');
      if (container) {
        enhanceCodeBlocks(triggerToast);
        const elements = Array.from(
          container.querySelectorAll('h2, h3')
        ) as HTMLElement[];
        if (elements.length === 0) return;

        elements.forEach(el => {
          el.classList.add('group', 'scroll-mt-20', 'cursor-pointer');

          const existingAnchor = el.querySelector('.anchor-link');
          if (existingAnchor) {
            existingAnchor.remove();
          }

          const headingText = el.querySelector('.heading-text');
          if (!headingText) {
            const span = document.createElement('span');
            span.className = 'heading-text';
            while (el.firstChild) {
              span.appendChild(el.firstChild);
            }
            el.appendChild(span);
          }

          const anchor = document.createElement('a');
          anchor.href = `#${el.id}`;
          anchor.className = 'anchor-link select-none';
          anchor.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link-2 text-[0.85em] leading-none inline-block align-middle select-none opacity-0" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>';

          el.onclick = async e => {
            e.preventDefault();
            const url = `${window.location.origin}${window.location.pathname}#${el.id}`;
            try {
              await navigator.clipboard.writeText(url);
              triggerToast('Subheading link copied to clipboard');
            } catch {}
            const target = document.getElementById(el.id);
            if (target) {
              target.scrollIntoView({behavior: 'smooth', block: 'start'});
              pushState(`#${el.id}`, {});
            }
          };
          el.appendChild(anchor);
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

    hljs.highlightAll();

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
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/{hljsTheme}.min.css" />
</svelte:head>

<svelte:window onpointerdown={handleWindowPointerDown} />

<SkipLink />

<TopNav
  ariaLabel="{title} navigation"
  backHref="/"
  backLabel="Back to Home"
  showFontSelect={true} />

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3.75rem)] flex-col pt-15 font-sans">
  <div
    class="relative mx-auto w-full px-6 pt-3 pb-16 sm:pt-4 md:w-[80%] lg:w-[65%] xl:w-[55%]">
    <aside
      class="sticky top-18 hidden h-fit max-h-[calc(100vh-5.5rem)] flex-col gap-4 self-start select-none xl:float-left xl:-ml-64 xl:flex xl:w-56"
      aria-label="Table of contents">
      <TableOfContents
        {headings}
        class="max-h-[calc(100vh-5.5rem)]" />
      <HelpfulBlock
        onVote={helpful => handleHelpfulness(helpful ? 'yes' : 'no')} />
    </aside>

    <article class="flex w-full flex-col">
      <Breadcrumb
        items={[{label: 'Home', href: '/'}, {label: title}]}
        class="mb-3" />

      <ArticleHeader {title}>
        {#snippet meta()}
          <div class="flex w-full items-center justify-between gap-2">
            <span class="text-xs font-medium text-text-muted">
              {#if updatedAt}
                Last updated {formatAbsoluteDate(updatedAt)}
              {:else}
                Official Policy
              {/if}
            </span>

            <div
              bind:this={copyMenuRef}
              class="relative z-20 inline-block shrink-0 text-left">
              <DropdownTrigger
                ariaLabel="Copy options menu"
                isOpen={showCopyMenu}
                size="sm"
                onclick={toggleCopyMenu}>
                <span class="inline-flex items-center gap-1">
                  <Copy class="size-3" />
                  Copy
                </span>
              </DropdownTrigger>

              {#if showCopyMenu}
                <button
                  type="button"
                  class="fixed inset-0 z-30 cursor-default"
                  onclick={() => (showCopyMenu = false)}
                  aria-label="Close menu"></button>

                <div
                  role="menu"
                  class="absolute top-[calc(100%+8px)] left-1/2 z-40 flex w-max min-w-40 -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl">
                  <div
                    class="relative z-10 flex flex-col overflow-hidden rounded-sm py-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onclick={copyPageUrl}
                      class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                      <LinkIcon class="size-3.5" />
                      <span>Copy URL</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onclick={copyAsMarkdown}
                      class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                      <svg
                        class="size-3.5 fill-current"
                        viewBox="0 0 24 24"
                        aria-hidden="true">
                        <path
                          d="M2.5 4A1.5 1.5 0 0 0 1 5.5v13A1.5 1.5 0 0 0 2.5 20h19a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 21.5 4h-19zm1 3h3l2 2.5 2-2.5h3v10h-2.5v-5.5L9.5 13.5 8 11.5v5.5H3.5V7zm13 0h4l-3 4.5h2V17h-2.5v-5.5h-2L16.5 7z" />
                      </svg>
                      <span>Copy as Markdown</span>
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/snippet}
      </ArticleHeader>

      <div class="mt-3 flex flex-col gap-3 xl:hidden">
        <TableOfContents
          {headings}
          collapsible={true}
          defaultCollapsed={true} />
        <HelpfulBlock
          onVote={helpful => handleHelpfulness(helpful ? 'yes' : 'no')} />
      </div>

      <div
        class="prose-custom font-content-{contentFontStore.current} mt-3 w-full">
        {@html html}
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
