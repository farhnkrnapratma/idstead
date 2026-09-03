<script lang="ts">
  import {onMount, tick, untrack} from 'svelte';
  import {SvelteSet} from 'svelte/reactivity';
  import {Mail, Image as ImageIcon, User} from '@lucide/svelte';
  import type {PageProps} from './$types';
  import type {BlogComment} from './+page.server';
  import hljs from 'highlight.js';
  import {
    isNameReserved,
    extractAuthorNameTokens
  } from '$lib/utils/nameValidator';
  import {enhanceMarkdownContent} from '$lib/utils/markdownEnhancer';
  import {cn} from '$lib/utils/cn';
  import 'katex/dist/katex.min.css';
  import {
    turnstileWidget,
    executeTurnstile,
    resetTurnstile,
    turnstileSiteKey
  } from '$lib/utils/turnstile';
  import {
    TopNav,
    Button,
    Card,
    Checkbox,
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
    formatCommentCount,
    formatViewCount,
    Dialog,
    ReportCommentDialog,
    ArticleHeader,
    ShareDialog,
    QrCodeDialog,
    ArticleMeta,
    HelpfulBlock,
    PostInsights,
    formatAbsoluteDate,
    ConsentNotice
  } from '$lib';
  import {pushState} from '$app/navigation';
  import {page, navigating} from '$app/state';
  import {supabase} from '$lib/supabase';
  import {themeStore} from '$lib/stores/themeStore.svelte';
  import {a11yStore} from '$lib/stores/a11yStore.svelte';
  import {contentFontStore} from '$lib/stores/contentFontStore.svelte';

  let {data}: PageProps = $props();
  const post = $derived(data.post);
  const isNavigatingToBlogPost = $derived(
    navigating.to?.route.id === '/blog/[slug]'
  );
  const html = $derived(data.html);
  const author = $derived(data.author);
  const authorTokens = $derived(extractAuthorNameTokens(author));

  const CONTENT_FONT_CLASS: Record<string, string> = {
    ja: 'font-sans-ja',
    zh: 'font-sans-zh',
    ko: 'font-sans-ko'
  };
  const language = $derived(data.language);
  const machineTranslated = $derived(data.machineTranslated);
  const translationDisclaimerHtml = $derived(data.translationDisclaimerHtml);
  const availableLocales = $derived(data.availableLocales);
  const langSwitcherOptions = $derived(['en', ...availableLocales]);
  function hrefForLang(lang: string): string {
    return lang === 'en' ?
        `/blog/${post.slug}`
      : `/blog/${post.slug}?lang=${lang}`;
  }

  function copyToClipboard() {
    if (typeof window === 'undefined') return;
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        toastStore.success('Copied!');
      })
      .catch(err => {
        console.error(err);
      });
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
      });
    }
  });
  const comments = $derived([...data.comments, ...addedComments]);
  const relatedPosts = $derived(data.relatedPosts);
  const failedRelatedBanners = new SvelteSet<string>();
  function markRelatedBannerFailed(postId: string) {
    failedRelatedBanners.add(postId);
  }
  let isDark = $state(false);

  const bannerPublicUrl = $derived(
    data.bannerPublicUrl
      || (data.post.banner_path ?
        supabase.storage.from('blog-posts').getPublicUrl(data.post.banner_path)
          .data.publicUrl
      : '')
  );

  const headings = $derived(data.headings || []);

  let showYesFeedbackDialog = $state(false);
  let showNoFeedbackDialog = $state(false);
  let showQrDialog = $state(false);
  let viewCount = $state<number | null>(
    untrack(() => data.initialViewsCount ?? null)
  );

  const mainAuthorUsername = $derived(author?.username || 'farhnkrnapratma');
  const collaboratorsList = $derived(
    Array.isArray(post.collaborators) ? post.collaborators.filter(Boolean) : []
  );
  const allAuthors = $derived([mainAuthorUsername, ...collaboratorsList]);
  const visibleAvatarAuthors = $derived(allAuthors.slice(0, 3));
  const hiddenCollaborators = $derived(allAuthors.slice(3));
  let isCollaboratorsPopoverOpen = $state(false);
  let collaboratorsContainerRef: HTMLDivElement | undefined = $state();
  const failedAvatars = new SvelteSet<string>();
  const loadedAvatars = new SvelteSet<string>();

  async function handleHelpfulness(value: 'yes' | 'no') {
    if (value === 'yes') {
      showYesFeedbackDialog = true;
    } else {
      showNoFeedbackDialog = true;
    }

    try {
      await fetch('/api/internal/blog/feedback', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({postId: post.id, vote: value})
      });
    } catch (err) {
      console.error('Failed to submit blog feedback:', err);
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
            } catch (err) {
              void err;
            }
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

    (async () => {
      try {
        await fetch('/api/internal/blog/views', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({postId: post.id})
        });
        const res = await fetch(
          `/api/v1/blog/views?postId=${encodeURIComponent(post.id)}`
        );
        const data = await res.json();
        viewCount = data.views ?? null;
      } catch {
        viewCount = null;
      }
    })();

    return () => {
      observer.disconnect();
    };
  });

  let authorName = $state('');
  let commentContent = $state('');
  let replyTo = $state<BlogComment | null>(null);
  let isSubmitting = $state(false);
  let turnstileEl = $state<HTMLDivElement | null>(null);
  let feedbackMessage = $state<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  let showReportDialog = $state(false);
  let reportingComment = $state<BlogComment | null>(null);

  function getCommentAuthor(comment: BlogComment) {
    if (comment.is_anonymous) return 'Anonymous';
    if (comment.is_admin) return 'Administrator';
    return comment.author_name || 'Anonymous';
  }

  function cancelReply() {
    replyTo = null;
    commentContent = '';
    feedbackMessage = null;
    errors = {authorName: '', commentContent: ''};
  }

  let errors = $state({authorName: '', commentContent: ''});
  let valid = $state({authorName: false, commentContent: false});

  function debounce<T extends unknown[]>(cb: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: T) => {
      clearTimeout(timer);
      timer = setTimeout(() => cb(...args), ms);
    };
  }

  const validateAuthorName = debounce(() => {
    const trimmed = authorName.trim();
    if (trimmed === '') {
      errors.authorName = '';
      valid.authorName = false;
    } else if (trimmed.length < 2) {
      errors.authorName = 'Name must be at least 2 characters.';
      valid.authorName = false;
    } else if (trimmed.length > 50) {
      errors.authorName = 'Name must be 50 characters or fewer.';
      valid.authorName = false;
    } else if (isNameReserved(trimmed, authorTokens)) {
      errors.authorName = 'This name cannot be used. Please use another name.';
      valid.authorName = false;
    } else {
      errors.authorName = '';
      valid.authorName = true;
    }
  }, 500);

  const validateCommentContent = debounce(() => {
    const trimmed = commentContent.trim();
    if (trimmed === '') {
      errors.commentContent = '';
      valid.commentContent = false;
    } else if (/(https?:\/\/|www\.[a-z0-9]|ftp:\/\/)/i.test(trimmed)) {
      errors.commentContent =
        'Links and URLs are not permitted in guest comments.';
      valid.commentContent = false;
    } else {
      errors.commentContent = '';
      valid.commentContent = true;
    }
  }, 500);

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
    const nameTrimmed = authorName.trim();
    let nameErr = '';
    if (!nameTrimmed) {
      nameErr = 'Name is required.';
    } else if (nameTrimmed.length < 2) {
      nameErr = 'Name must be at least 2 characters.';
    } else if (nameTrimmed.length > 50) {
      nameErr = 'Name must be 50 characters or fewer.';
    } else if (isNameReserved(nameTrimmed, authorTokens)) {
      nameErr = 'This name cannot be used. Please use another name.';
    }

    let msgErr = '';
    const msgTrimmed = commentContent.trim();
    if (!msgTrimmed) {
      msgErr = 'Message is required.';
    } else if (msgTrimmed.length > 2000) {
      msgErr = 'Message must be 2000 characters or fewer.';
    } else if (/(https?:\/\/|www\.[a-z0-9]|ftp:\/\/)/i.test(msgTrimmed)) {
      msgErr = 'Links and URLs are not permitted in guest comments.';
    }

    errors = {authorName: nameErr, commentContent: msgErr};
    valid = {authorName: !nameErr, commentContent: !msgErr};

    return !nameErr && !msgErr;
  }

  async function handleSubmit(e: SubmitEvent, parentId: string | null = null) {
    e.preventDefault();
    errors = {authorName: '', commentContent: ''};
    if (!validate()) return;

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
        headers: {'Content-Type': 'application/json'},
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
          text:
            parentId ?
              'Your reply has been posted.'
            : 'Your comment has been posted.'
        };
        commentContent = '';
        authorName = '';
        valid = {authorName: false, commentContent: false};
        errors = {authorName: '', commentContent: ''};
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

  let siteUrl = $derived(
    (author?.siteUrl || page.url.origin).replace(/\/$/, '')
  );

  let jsonLdScript = $derived(
    '<script type="application/ld+json">'
      + JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt || post.title,
        url: siteUrl + '/blog/' + post.slug,
        datePublished: post.created_at,
        author: {'@type': 'Person', name: author?.name || '', url: siteUrl}
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
    href={siteUrl + hrefForLang(language)} />
  <link
    rel="alternate"
    hreflang="x-default"
    href={siteUrl + hrefForLang('en')} />
  {#each langSwitcherOptions as loc (loc)}
    <link
      rel="alternate"
      hreflang={loc}
      href={siteUrl + hrefForLang(loc)} />
  {/each}
  {@html jsonLdScript}

  <meta
    property="og:type"
    content="article" />
  <meta
    property="og:locale"
    content={language === 'en' ? 'en_US'
    : language === 'id' ? 'id_ID'
    : language === 'ja' ? 'ja_JP'
    : 'zh_CN'} />
  {#each langSwitcherOptions.filter(loc => loc !== language) as loc (loc)}
    <meta
      property="og:locale:alternate"
      content={loc === 'en' ? 'en_US'
      : loc === 'id' ? 'id_ID'
      : loc === 'ja' ? 'ja_JP'
      : 'zh_CN'} />
  {/each}
  <meta
    property="og:url"
    content={siteUrl + hrefForLang(language)} />
  <meta
    property="og:title"
    content={post.title} />
  {#if post.excerpt}
    <meta
      property="og:description"
      content={post.excerpt} />
  {/if}
  {#if bannerPublicUrl}
    <meta
      property="og:image"
      content={bannerPublicUrl} />
    <meta
      property="og:image:secure_url"
      content={bannerPublicUrl} />
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
  {#if bannerPublicUrl}
    <meta
      name="twitter:image"
      content={bannerPublicUrl} />
    <meta
      property="twitter:image"
      content={bannerPublicUrl} />
  {/if}
</svelte:head>

<TopNav
  ariaLabel="Article navigation"
  backHref="/#blog"
  backLabel="Back to Blog"
  showFontSelect={true}
  projects={data.projects}
  languageSwitcher={{
    slug: post.slug,
    currentLanguage: language,
    availableLocales
  }} />

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3rem)] flex-col pt-12 font-sans sm:min-h-[calc(100vh-3.5rem)] sm:pt-14">
  <div
    class="relative mx-auto w-full px-6 pt-3 pb-16 sm:pt-4 md:w-[80%] lg:w-[65%] xl:w-[55%]">
    <aside
      class="hidden select-none xl:fixed xl:top-18 xl:right-[calc(50%+27.5%+1.5rem)] xl:z-20 xl:flex xl:max-h-[calc(100dvh-9.5rem)] xl:w-56 xl:flex-col xl:gap-3"
      aria-label="Table of contents">
      <TableOfContents
        {headings}
        class="max-h-[calc(100dvh-15.5rem)] min-h-0 flex-1" />
      <HelpfulBlock
        onVote={helpful => handleHelpfulness(helpful ? 'yes' : 'no')} />
    </aside>

    <article class="flex w-full flex-col">
      <ArticleHeader
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
                  <div
                    class="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-surface-base bg-surface-elevated">
                    {#if !loadedAvatars.has(user)}
                      <User class="size-3 text-text-muted" />
                    {/if}
                    {#if !failedAvatars.has(user)}
                      <img
                        src="https://github.com/{user}.png?size=64"
                        alt={user}
                        class="absolute inset-0 size-full object-cover transition-opacity duration-200 {(
                          loadedAvatars.has(user)
                        ) ?
                          'opacity-100'
                        : 'opacity-0'}"
                        loading="lazy"
                        onload={() => loadedAvatars.add(user)}
                        onerror={() => failedAvatars.add(user)} />
                    {/if}
                  </div>
                </a>
              {/each}
            </div>

            <div
              class="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5 font-sans-title text-xs text-text-secondary">
              <span>Authored by</span>
              {#if allAuthors.length === 1}
                <a
                  href="https://github.com/{allAuthors[0]}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-copilot hover:underline">
                  {allAuthors[0]}
                </a>
              {:else if allAuthors.length === 2}
                <a
                  href="https://github.com/{allAuthors[0]}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-copilot hover:underline">
                  {allAuthors[0]}
                </a>
                <span>and</span>
                <a
                  href="https://github.com/{allAuthors[1]}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-copilot hover:underline">
                  {allAuthors[1]}
                </a>
              {:else if allAuthors.length === 3}
                <span class="inline-flex items-center">
                  <a
                    href="https://github.com/{allAuthors[0]}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-copilot hover:underline"
                    >{allAuthors[0]}</a
                  >,
                </span>
                <span class="inline-flex items-center">
                  <a
                    href="https://github.com/{allAuthors[1]}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-copilot hover:underline"
                    >{allAuthors[1]}</a
                  >,
                </span>
                <span>and</span>
                <a
                  href="https://github.com/{allAuthors[2]}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-copilot hover:underline">
                  {allAuthors[2]}
                </a>
              {:else}
                <span class="inline-flex items-center">
                  <a
                    href="https://github.com/{allAuthors[0]}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-copilot hover:underline"
                    >{allAuthors[0]}</a
                  >,
                </span>
                <span class="inline-flex items-center">
                  <a
                    href="https://github.com/{allAuthors[1]}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-copilot hover:underline"
                    >{allAuthors[1]}</a
                  >,
                </span>
                <span class="inline-flex items-center">
                  <a
                    href="https://github.com/{allAuthors[2]}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-semibold text-text-primary underline-offset-4 transition-colors hover:text-copilot hover:underline"
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
                    class="cursor-pointer font-semibold text-text-primary underline-offset-4 transition-colors hover:text-copilot hover:underline"
                    onclick={() => {
                      isCollaboratorsPopoverOpen = !isCollaboratorsPopoverOpen;
                    }}>
                    {hiddenCollaborators.length} other{(
                      hiddenCollaborators.length > 1
                    ) ?
                      's'
                    : ''}
                  </button>

                  {#if isCollaboratorsPopoverOpen}
                    <div
                      role="dialog"
                      aria-label="Other Collaborators"
                      class="absolute top-full right-0 z-50 mt-2 flex w-max max-w-[calc(100vw-2.5rem)] min-w-36 flex-col gap-0.5 rounded-sm border border-border-subtle bg-surface-elevated p-1.5 shadow-lg sm:right-auto sm:left-0">
                      <span
                        class="px-1.5 py-0.5 text-2xs font-semibold tracking-wider text-text-muted uppercase">
                        {hiddenCollaborators.length > 1 ?
                          'Other Collaborators'
                        : 'Other Collaborator'}
                      </span>
                      {#each hiddenCollaborators as collab (collab)}
                        <a
                          href="https://github.com/{collab}"
                          target="_blank"
                          rel="noopener noreferrer"
                          onclick={() => (isCollaboratorsPopoverOpen = false)}
                          class="flex items-center gap-2 rounded-sm px-1.5 py-1 font-sans-title text-xs transition-colors hover:bg-surface-hover hover:text-copilot">
                          <div
                            class="relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-surface-card">
                            {#if !loadedAvatars.has(collab)}
                              <User class="size-3 text-text-muted" />
                            {/if}
                            {#if !failedAvatars.has(collab)}
                              <img
                                src="https://github.com/{collab}.png?size=64"
                                alt={collab}
                                class="absolute inset-0 size-full object-cover transition-opacity duration-200 {(
                                  loadedAvatars.has(collab)
                                ) ?
                                  'opacity-100'
                                : 'opacity-0'}"
                                loading="lazy"
                                onload={() => loadedAvatars.add(collab)}
                                onerror={() => failedAvatars.add(collab)} />
                            {/if}
                          </div>
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
            class="mt-2.5 w-full" />

          <ContentActions
            class="mt-3 w-full"
            slug={post.slug}
            pageId={post.id}
            title={post.title}
            avatarUrl={author?.avatar}
            viewMarkdownUrl="/api/v1/blog/{post.slug}?format=md"
            viewTextUrl="/api/v1/blog/{post.slug}?format=text" />
        {/snippet}
      </ArticleHeader>

      {#if (machineTranslated && translationDisclaimerHtml) || (post.tldr && post.tldr.length > 0) || post.summary}
        <div class="mt-3 flex flex-col gap-3">
          {#if machineTranslated && translationDisclaimerHtml}
            <div
              class="translation-disclaimer prose-custom my-0 [&>.markdown-alert]:my-0!">
              {@html translationDisclaimerHtml}
            </div>
          {/if}

          <PostInsights
            tldr={post.tldr}
            summary={post.summary}
            class="mt-0!" />
        </div>
      {/if}

      <div class="mt-3 flex flex-col xl:hidden">
        <TableOfContents
          {headings}
          collapsible={true}
          defaultCollapsed={true} />
      </div>

      <div
        class="prose-custom font-content-{contentFontStore.current} {CONTENT_FONT_CLASS[
          language
        ] ?? ''} mt-3 w-full">
        {@html html}
      </div>

      <div class="mt-8 flex flex-col gap-6 select-none sm:mt-12">
        <div class="xl:hidden">
          <HelpfulBlock
            onVote={helpful => handleHelpfulness(helpful ? 'yes' : 'no')} />
        </div>

        <div class="border-t border-border-subtle pt-6">
          <h3 class="mb-3 text-sm font-bold tracking-tight text-text-primary">
            Share this article
          </h3>
          <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-3 sm:gap-2">
            <Button
              href={`https://x.com/intent/post?url=${encodeURIComponent(page.url.href)}&text=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              type="secondary"
              size="sm"
              class="w-full justify-center px-2 py-2 sm:px-3"
              title="Share on X"
              aria-label="Share on X (opens in a new tab)">
              {#snippet leading()}
                <i
                  class="bi bi-twitter-x inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:align-[0] [&::before]:leading-none"
                  aria-hidden="true"></i>
              {/snippet}
              <span class="hidden truncate sm:inline">X</span>
            </Button>

            <Button
              href={`https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(page.url.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              type="secondary"
              size="sm"
              class="w-full justify-center px-2 py-2 sm:px-3"
              title="Share on LinkedIn"
              aria-label="Share on LinkedIn (opens in a new tab)">
              {#snippet leading()}
                <i
                  class="bi bi-linkedin inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:align-[0] [&::before]:leading-none"
                  aria-hidden="true"></i>
              {/snippet}
              <span class="hidden truncate sm:inline">LinkedIn</span>
            </Button>

            <Button
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(post.title)}%20${encodeURIComponent(page.url.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              type="secondary"
              size="sm"
              class="w-full justify-center px-2 py-2 sm:px-3"
              title="Share on WhatsApp"
              aria-label="Share on WhatsApp (opens in a new tab)">
              {#snippet leading()}
                <i
                  class="bi bi-whatsapp inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:align-[0] [&::before]:leading-none"
                  aria-hidden="true"></i>
              {/snippet}
              <span class="hidden truncate sm:inline">WhatsApp</span>
            </Button>

            <Button
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(page.url.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              type="secondary"
              size="sm"
              class="w-full justify-center px-2 py-2 sm:px-3"
              title="Share on Facebook"
              aria-label="Share on Facebook (opens in a new tab)">
              {#snippet leading()}
                <i
                  class="bi bi-facebook inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:align-[0] [&::before]:leading-none"
                  aria-hidden="true"></i>
              {/snippet}
              <span class="hidden truncate sm:inline">Facebook</span>
            </Button>

            <Button
              href={`https://reddit.com/submit?url=${encodeURIComponent(page.url.href)}&title=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              type="secondary"
              size="sm"
              class="w-full justify-center px-2 py-2 sm:px-3"
              title="Share on Reddit"
              aria-label="Share on Reddit (opens in a new tab)">
              {#snippet leading()}
                <i
                  class="bi bi-reddit inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:align-[0] [&::before]:leading-none"
                  aria-hidden="true"></i>
              {/snippet}
              <span class="hidden truncate sm:inline">Reddit</span>
            </Button>

            <Button
              href={`mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(page.url.href)}`}
              type="secondary"
              size="sm"
              class="w-full justify-center px-2 py-2 sm:px-3"
              title="Share via Email"
              aria-label="Share via email">
              {#snippet leading()}
                <i
                  class="bi bi-envelope-fill inline-flex size-4 shrink-0 items-center justify-center text-sm leading-none [&::before]:align-[0] [&::before]:leading-none"
                  aria-hidden="true"></i>
              {/snippet}
              <span class="hidden truncate sm:inline">Email</span>
            </Button>
          </div>
        </div>
      </div>

      {#if relatedPosts.length > 0}
        <section
          class="mt-12 border-t border-border-subtle pt-8"
          aria-label="Related posts">
          <h3 class="mb-4 text-sm font-bold tracking-tight text-text-primary">
            Continue reading
          </h3>
          <div class="relative z-0 grid grid-cols-1 gap-4">
            {#each relatedPosts as related (related.id)}
              <Card
                class="relative flex flex-col gap-3.5 p-4 text-left sm:flex-row sm:gap-4">
                <div
                  class="aspect-video w-full shrink-0 overflow-hidden rounded-sm border border-border-subtle sm:w-48 md:w-56">
                  {#if related.bannerPublicUrl && !failedRelatedBanners.has(related.id)}
                    <ImageWithSkeleton
                      src={related.bannerPublicUrl}
                      alt={related.title}
                      aspectRatio="aspect-video"
                      onerror={() => markRelatedBannerFailed(related.id)}
                      class="h-full w-full object-cover" />
                  {:else}
                    <div
                      class="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 to-copilot/15 select-none">
                      <ImageIcon class="size-8 text-copilot/50" />
                    </div>
                  {/if}
                </div>

                <div
                  class="flex min-w-0 flex-1 flex-col justify-between gap-2.5 font-sans">
                  <div class="flex flex-col gap-1">
                    <div>
                      <h4
                        class="line-clamp-2 font-sans-title text-lg leading-snug font-bold text-text-primary">
                        {related.title}
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
                      <p
                        class="line-clamp-2 text-xs leading-relaxed text-text-secondary">
                        {related.excerpt}
                      </p>
                    {/if}
                  </div>

                  <div class="relative z-20 mt-auto flex flex-col gap-2 pt-1">
                    <hr class="border-border-subtle/50" />
                    <Button
                      href="/blog/{related.slug}"
                      type="primary"
                      size="sm"
                      fullWidth>
                      Read post
                    </Button>
                  </div>
                </div>
              </Card>
            {/each}
          </div>
        </section>
      {/if}

      <section
        class="mt-16 border-t border-border-subtle pt-10"
        aria-label="Comments">
        <h2
          class="mb-8 font-sans-title text-xl font-bold tracking-tight text-text-primary">
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
            class="mb-6 rounded-sm border border-border-subtle bg-surface-card/75 p-3.5 text-left shadow-2xs sm:p-4">
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
                    validateAuthorName();
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
                    validateCommentContent();
                  }}
                  aria-required="true" />
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

              <div class="mt-1 flex justify-end">
                <Button
                  htmlType="submit"
                  type="primary"
                  size="md"
                  disabled={isSubmitting}
                  isLoading={isSubmitting}>
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
              <span aria-hidden="true">&middot;</span>
              <button
                type="button"
                onclick={() => {
                  replyTo = comment;
                  feedbackMessage = null;
                  commentContent = '';
                }}
                class="cursor-pointer font-bold text-text-muted transition-colors hover:text-copilot focus-visible:outline-none">
                Reply
              </button>
            {/snippet}

            {#snippet replyForm(comment)}
              <form
                novalidate
                onsubmit={e => handleSubmit(e, comment.id)}
                class="mb-3 rounded-sm border border-border-subtle bg-surface-base/80 p-3.5 text-left shadow-2xs sm:p-4">
                <div
                  class="mb-3 flex items-center justify-between gap-3 border-b border-border-subtle/50 pb-2.5">
                  <p
                    class="font-sans-title text-xs font-semibold text-text-secondary">
                    Replying to {getCommentAuthor(comment)}
                  </p>
                  <Button
                    type="ghost"
                    size="sm"
                    showEscHint
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
                        validateAuthorName();
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
                        validateCommentContent();
                      }}
                      aria-required="true" />
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

                  <div class="mt-1 flex justify-end">
                    <Button
                      htmlType="submit"
                      type="primary"
                      size="sm"
                      disabled={isSubmitting}
                      isLoading={isSubmitting}>
                      {isSubmitting ? 'Posting…' : 'Post reply'}
                    </Button>
                  </div>
                </div>
              </form>
            {/snippet}
          </CommentThread>
        {/if}
      </section>
    </article>
  </div>

  <FooterSection showFontSelect={true} />
</main>

<ReportCommentDialog
  bind:isOpen={showReportDialog}
  comment={reportingComment}
  onClose={() => {
    reportingComment = null;
  }} />

<ShareDialog
  bind:isOpen={showYesFeedbackDialog}
  title="Thanks for your feedback! Share this article?"
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
    <Button
      type="secondary"
      size="md"
      showEscHint
      onclick={() => {
        showNoFeedbackDialog = false;
      }}>Cancel</Button>
    <Button
      type="primary"
      size="md"
      onclick={() => {
        showNoFeedbackDialog = false;
        window.location.href = '/feedback';
      }}>Send feedback</Button>
  {/snippet}
</Dialog>

<style>
  @reference "../../global.css";

  .prose-custom {
    @apply text-[0.975rem] leading-[1.75] text-(--color-body);
    --color-heading: var(--color-text-primary);
    --color-body: var(--color-text-secondary);
    --color-link: var(--color-copilot);
    --color-link-hover: var(--color-copilot-hover);
  }

  .prose-custom :global(p) {
    @apply mt-5 mb-5 text-(--color-body);
  }

  .prose-custom :global(h1),
  .prose-custom :global(h2),
  .prose-custom :global(h3),
  .prose-custom :global(h4),
  .prose-custom :global(h5),
  .prose-custom :global(h6) {
    @apply text-(--color-heading);
  }

  .prose-custom :global(h1) {
    @apply mt-8 mb-4 text-2xl font-extrabold sm:text-3xl;
  }

  .prose-custom :global(h2) {
    @apply mt-7 mb-3 text-xl font-bold sm:text-2xl;
  }

  .prose-custom :global(h3) {
    @apply mt-6 mb-2 text-lg font-semibold sm:text-xl;
  }

  .prose-custom :global(h4) {
    @apply mt-5 mb-2 text-base font-semibold sm:text-lg;
  }

  .prose-custom :global(h5) {
    @apply mt-4 mb-2 text-sm font-semibold sm:text-base;
  }

  .prose-custom :global(h6) {
    @apply mt-4 mb-2 text-xs font-semibold sm:text-sm;
  }

  .prose-custom :global(li > p) {
    @apply my-0!;
  }

  .prose-custom :global(pre) {
    @apply mt-6 mb-6 scrollbar-none! overflow-x-auto rounded-sm border border-border-subtle bg-surface-hover px-3! py-1.5! font-mono text-[0.8rem] leading-snug break-normal! whitespace-pre! [-ms-overflow-style:none]!;
  }

  .prose-custom :global(pre[data-enhanced='true']) {
    @apply pt-0! pr-0! pl-0!;
  }

  .prose-custom :global(pre)::-webkit-scrollbar {
    @apply hidden! h-0! w-0!;
  }

  .prose-custom :global(code:not(pre code)) {
    @apply rounded bg-code-inline-bg px-0.5 py-px font-mono text-[0.925em] font-normal wrap-break-word [word-break:break-word] text-inherit;
  }

  .prose-custom :global(pre code) {
    @apply block! w-max! min-w-full! overflow-visible! border-0 bg-transparent py-0! pr-0! pl-0! font-mono text-[0.8rem] leading-snug break-normal! whitespace-pre!;
  }

  .prose-custom :global(.code-line) {
    @apply block! w-full! pr-3.5! pl-2!;
  }

  .prose-custom :global(pre.code-wrap),
  .prose-custom :global(pre[data-wrap='true']) {
    @apply overflow-x-hidden! wrap-anywhere! [word-break:break-word]! whitespace-pre-wrap!;
  }

  .prose-custom :global(pre.code-wrap code),
  .prose-custom :global(pre[data-wrap='true'] code) {
    @apply box-border! block! w-full! max-w-full! overflow-x-hidden! wrap-anywhere! [word-break:break-word]! whitespace-pre-wrap!;
  }

  .prose-custom :global(pre.code-wrap .code-line),
  .prose-custom :global(pre[data-wrap='true'] .code-line) {
    @apply box-border! w-full! max-w-full! pl-[calc(0.5rem+4ch)]! indent-[-4ch] wrap-anywhere! [word-break:break-word]! whitespace-pre-wrap!;
  }

  .prose-custom :global(a:not(.anchor-link)) {
    @apply text-security no-underline hover:underline;
  }

  .prose-custom :global(.heading-text) {
    @apply inline! transition-none!;
  }

  .prose-custom :global(a.anchor-link) {
    @apply ml-[0.35rem]! inline-flex! items-center! justify-center! align-middle! leading-none! whitespace-nowrap! text-text-primary! no-underline! transition-none!;
  }

  :global(:root.dark) .prose-custom :global(a.anchor-link) {
    @apply text-gh-gray-4!;
  }

  .prose-custom :global(a.anchor-link svg) {
    @apply inline-block! size-[0.85em]! align-middle! leading-none! text-inherit! no-underline!;
  }

  .prose-custom :global(h1:hover .heading-text),
  .prose-custom :global(h2:hover .heading-text),
  .prose-custom :global(h3:hover .heading-text),
  .prose-custom :global(h4:hover .heading-text),
  .prose-custom :global(h5:hover .heading-text),
  .prose-custom :global(h6:hover .heading-text),
  .prose-custom :global(.heading-text):hover,
  :global(:root.dark) .prose-custom :global(h1:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h2:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h3:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h4:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h5:hover .heading-text),
  :global(:root.dark) .prose-custom :global(h6:hover .heading-text),
  :global(:root.dark) .prose-custom :global(.heading-text):hover {
    @apply text-copilot underline underline-offset-4;
  }

  .prose-custom :global(h1:hover a.anchor-link),
  .prose-custom :global(h2:hover a.anchor-link),
  .prose-custom :global(h3:hover a.anchor-link),
  .prose-custom :global(h4:hover a.anchor-link),
  .prose-custom :global(h5:hover a.anchor-link),
  .prose-custom :global(h6:hover a.anchor-link),
  .prose-custom :global(a.anchor-link):hover,
  :global(:root.dark) .prose-custom :global(h1:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h2:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h3:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h4:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h5:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(h6:hover a.anchor-link),
  :global(:root.dark) .prose-custom :global(a.anchor-link):hover,
  .prose-custom :global(h1:hover a.anchor-link svg),
  .prose-custom :global(h2:hover a.anchor-link svg),
  .prose-custom :global(h3:hover a.anchor-link svg),
  .prose-custom :global(h4:hover a.anchor-link svg),
  .prose-custom :global(h5:hover a.anchor-link svg),
  .prose-custom :global(h6:hover a.anchor-link svg),
  .prose-custom :global(a.anchor-link):hover :global(svg),
  :global(:root.dark) .prose-custom :global(h1:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h2:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h3:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h4:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h5:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(h6:hover a.anchor-link svg),
  :global(:root.dark) .prose-custom :global(a.anchor-link):hover :global(svg) {
    @apply text-copilot! no-underline! opacity-100;
  }

  .prose-custom :global(table) {
    @apply my-6 w-full max-w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-sm border border-border-subtle text-left text-xs shadow-2xs;
  }

  .prose-custom :global(thead) {
    @apply border-b border-border-subtle bg-surface-hover/80 font-semibold tracking-wider text-text-primary uppercase;
  }

  .prose-custom :global(th) {
    @apply w-[1%] px-2.5 py-2 text-center font-semibold wrap-break-word [word-break:break-word] text-text-primary;
  }

  .prose-custom :global(tbody tr) {
    @apply transition-colors hover:bg-surface-hover/30;
  }

  .prose-custom :global(td) {
    @apply w-[1%] border-r border-border-subtle/40 px-2.5 py-1.5 text-left leading-relaxed wrap-break-word [word-break:break-word] text-text-secondary last:border-r-0;
  }

  .prose-custom :global(td code),
  .prose-custom :global(th code) {
    @apply wrap-anywhere [word-break:break-word] whitespace-normal;
  }

  .prose-custom :global(td[align='right']) {
    @apply text-right;
  }

  .prose-custom :global(td[align='center']) {
    @apply text-center;
  }

  .prose-custom :global(hr) {
    @apply my-8 h-px border-0 bg-border-subtle;
  }

  .prose-custom :global(blockquote:not(.markdown-alert)) {
    @apply my-6 rounded-sm border border-border-default/40 bg-surface-hover/30 p-4 text-sm leading-relaxed text-text-secondary;
  }

  .prose-custom :global(blockquote:not(.markdown-alert) p) {
    @apply my-1 text-text-secondary;
  }

  .prose-custom :global(ul) {
    @apply my-2 flex list-none flex-col gap-1 pl-0!;
  }

  .prose-custom :global(ol) {
    @apply my-2 list-decimal space-y-1 pl-6!;
  }

  .prose-custom :global(ul ul),
  .prose-custom :global(ol ul),
  .prose-custom :global(.ul-content > ul),
  .prose-custom :global(.task-content > ul) {
    @apply my-1 pl-0!;
  }

  .prose-custom :global(ul ol),
  .prose-custom :global(ol ol),
  .prose-custom :global(.ul-content > ol),
  .prose-custom :global(.task-content > ol) {
    @apply my-1 pl-6!;
  }

  .prose-custom :global(li.ul-list-item),
  .prose-custom :global(li.task-list-item) {
    @apply my-0.5 flex list-none items-start gap-2 pl-0!;
  }

  .prose-custom :global(li.ol-list-item) {
    @apply my-0.5 pl-0.5!;
  }

  .prose-custom :global(li p),
  .prose-custom :global(li > p) {
    margin: 0 !important;
    display: inline !important;
  }

  .prose-custom :global(.markdown-alert) {
    @apply my-6 rounded-sm border p-4 text-xs transition-colors duration-200 sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-title) {
    @apply mb-1.5 flex items-center gap-2 font-sans-title text-xs leading-none font-semibold select-none sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-title svg) {
    @apply size-4 shrink-0 translate-y-[-6%];
  }

  .prose-custom :global(.markdown-alert-content) {
    @apply leading-relaxed text-text-secondary;
  }

  .prose-custom :global(.markdown-alert-content > p) {
    @apply my-1 text-text-secondary;
  }

  .prose-custom :global(.markdown-alert-content > *:first-child) {
    @apply mt-0!;
  }

  .prose-custom :global(.markdown-alert-content > *:last-child) {
    @apply mb-0!;
  }

  .prose-custom :global(.markdown-alert-note) {
    @apply border-security/40 bg-security-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-note .markdown-alert-title) {
    @apply text-security;
  }

  .prose-custom :global(.markdown-alert-tip) {
    @apply border-success/40 bg-success-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-tip .markdown-alert-title) {
    @apply text-success;
  }

  .prose-custom :global(.markdown-alert-important) {
    @apply border-copilot/40 bg-copilot-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-important .markdown-alert-title) {
    @apply text-copilot;
  }

  .prose-custom :global(.markdown-alert-warning) {
    @apply border-warning/40 bg-warning-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-warning .markdown-alert-title) {
    @apply text-warning-strong;
  }

  .prose-custom :global(.markdown-alert-caution) {
    @apply border-danger/40 bg-danger-subtle text-text-secondary;
  }
  .prose-custom :global(.markdown-alert-caution .markdown-alert-title) {
    @apply text-danger;
  }

  .translation-disclaimer :global(.markdown-alert) {
    @apply mb-2;
  }

  .prose-custom :global(mark) {
    @apply rounded-sm bg-security-subtle px-1 py-0.5 font-normal text-security;
  }

  .prose-custom :global(kbd) {
    @apply inline-block rounded bg-code-inline-bg px-1.5 py-0.5 font-mono text-[0.875em] leading-normal font-normal text-inherit;
  }

  .prose-custom :global(sub) {
    @apply align-sub text-[0.75em] leading-none;
  }

  .prose-custom :global(sup) {
    @apply align-super text-[0.75em] leading-none;
  }

  .prose-custom :global(.markdown-steps-container) {
    --step-line-w: 1px;
    --step-badge-size: 1.5rem;
    @apply relative my-6 ml-0 space-y-0 select-text;
    counter-reset: step-counter;
  }

  .prose-custom
    :global(
      .markdown-steps-container > :not(.markdown-steps-list):not(.markdown-step)
    ) {
    @apply pl-9;
  }

  .prose-custom :global(.markdown-step) {
    counter-increment: step-counter;
    @apply relative pb-6 pl-9 text-text-secondary;
  }

  .prose-custom :global(.markdown-step:last-child) {
    @apply pb-0;
  }

  .prose-custom :global(.markdown-step::before) {
    content: counter(step-counter);
    position: absolute;
    top: 0.125rem;
    left: 0;
    width: var(--step-badge-size);
    height: var(--step-badge-size);
    line-height: var(--step-badge-size);
    background-color: color-mix(
      in srgb,
      var(--color-text-primary) 8%,
      var(--color-surface-base)
    );
    @apply z-10 flex items-center justify-center rounded border border-border-subtle/70 text-center font-mono text-xs font-medium text-text-primary tabular-nums select-none;
  }

  .prose-custom :global(.markdown-step::after) {
    content: '';
    position: absolute;
    top: calc(var(--step-badge-size) / 2 + 0.125rem);
    left: calc(var(--step-badge-size) / 2 - 0.5px);
    width: var(--step-line-w);
    bottom: calc(-1 * var(--step-badge-size) / 2 - 0.125rem);
    @apply pointer-events-none bg-border-subtle;
  }

  .prose-custom :global(.markdown-step:last-child::after) {
    display: none;
  }

  .prose-custom :global(.markdown-step > :is(h2, h3, h4)) {
    @apply relative mt-0! mb-2 flex items-center font-bold text-text-primary;
  }

  .prose-custom :global(.markdown-steps-list) {
    @apply my-0! list-none! space-y-0! pl-0!;
  }

  .prose-custom :global(.markdown-steps-list > li.markdown-step) {
    @apply relative my-0! list-none! pb-6 pl-9 text-text-secondary;
  }

  .prose-custom :global(.markdown-steps-list > li.markdown-step:last-child) {
    @apply pb-0!;
  }

  .prose-custom
    :global(.markdown-steps-list > li.markdown-step:last-child::after) {
    display: none;
  }

  .prose-custom :global(.markdown-tab-group) {
    @apply my-6;
  }

  .prose-custom :global(.markdown-tab-group-header) {
    @apply relative flex min-h-8 items-end border-b border-border-subtle select-none;
  }

  .prose-custom :global(.markdown-tab-group-nav) {
    @apply m-0 flex min-w-0 flex-1 scrollbar-none items-end gap-1.5 overflow-x-auto p-0 [-ms-overflow-style:none];
  }

  .prose-custom :global(.markdown-tab-group-body) {
    @apply pt-2;
  }

  .prose-custom
    :global(.markdown-tab-group-body > .markdown-tab-panel > :first-child) {
    @apply mt-2!;
  }

  .prose-custom :global(.markdown-tab-group .markdown-tab-panel) {
    @apply p-0;
  }

  .prose-custom :global(.markdown-tabs-container) {
    @apply my-6 rounded-sm border border-border-subtle shadow-2xs;
  }

  .prose-custom :global(.markdown-tabs-header) {
    @apply relative flex min-h-8 items-end justify-between rounded-t-sm border-b border-border-subtle px-3 pt-0 pb-0 select-none;
  }

  .prose-custom :global(.markdown-tabs-nav) {
    @apply m-0 flex min-w-0 flex-1 scrollbar-none items-end gap-1.5 overflow-x-auto p-0 [-ms-overflow-style:none];
  }

  .prose-custom :global(.markdown-tabs-actions) {
    @apply ml-2 flex shrink-0 items-center gap-1 self-center pb-0.5;
  }

  .prose-custom :global(.markdown-tab-button) {
    @apply relative -mb-px inline-flex shrink-0 cursor-pointer items-center justify-center border-b-[2.5px] px-3 py-1.5 text-xs font-medium transition-all select-none;
  }

  .prose-custom :global(.markdown-tab-button.active-tab) {
    @apply border-b-copilot font-bold text-copilot;
  }

  .prose-custom :global(.markdown-tab-button:not(.active-tab)) {
    @apply border-b-transparent text-text-muted hover:text-text-primary;
  }

  .prose-custom :global(.markdown-tabs-body) {
    @apply rounded-b-sm;
  }

  .prose-custom :global(.markdown-tabs-container .markdown-tab-panel) {
    @apply rounded-b-sm p-4;
  }

  .prose-custom
    :global(
      .markdown-tabs-container .markdown-tab-panel:has(> .code-block-container)
    ),
  .prose-custom
    :global(.markdown-tabs-container .markdown-tab-panel:has(> .code-body)),
  .prose-custom
    :global(.markdown-tabs-container .markdown-tab-panel:has(> pre)),
  .prose-custom
    :global(
      .markdown-tabs-container .markdown-tab-panel:has(.code-block-container)
    ) {
    @apply rounded-b-sm p-0!;
  }

  .prose-custom :global(.markdown-tabs-container .code-block-container) {
    @apply my-0! rounded-b-sm! border-0!;
  }

  .prose-custom :global(.markdown-tabs-container .code-header-bar) {
    @apply hidden!;
  }

  .prose-custom :global(.markdown-tabs-container .code-body) {
    @apply rounded-b-sm! border-0!;
  }

  .prose-custom :global(.markdown-tabs-container .code-scrollbar-wrapper) {
    @apply rounded-b-sm! border-0!;
  }

  .prose-custom :global(.markdown-tabs-container pre) {
    @apply my-0! rounded-b-sm! border-0!;
  }

  .prose-custom :global(details.markdown-details),
  .prose-custom :global(details) {
    @apply my-4 overflow-hidden rounded-sm glass-card border border-border-subtle text-text-primary shadow-md backdrop-blur-md;
    border: 1px solid var(--color-border-subtle);
  }

  :global(.dark) .prose-custom :global(details.markdown-details),
  :global(.dark) .prose-custom :global(details) {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .prose-custom :global(details > summary),
  .prose-custom :global(.markdown-details-summary) {
    @apply flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 border-b border-transparent px-3.5 py-1.5 font-sans-title text-sm font-medium text-text-primary transition-colors select-none hover:bg-surface-hover/50 [&::-webkit-details-marker]:hidden;
  }

  .prose-custom :global(details[open] > summary),
  .prose-custom :global(details[open] .markdown-details-summary) {
    border-bottom: 1px solid var(--color-border-subtle) !important;
    @apply bg-surface-hover/30;
  }

  :global(.dark) .prose-custom :global(details[open] > summary),
  :global(.dark)
    .prose-custom
    :global(details[open] .markdown-details-summary) {
    border-bottom-color: rgba(255, 255, 255, 0.1) !important;
  }

  .prose-custom :global(.markdown-details-title) {
    @apply inline-flex translate-y-px items-center text-sm leading-none font-medium text-text-primary;
  }

  .prose-custom :global(.markdown-details-icon) {
    @apply inline-flex shrink-0 items-center justify-center text-text-muted;
  }

  .prose-custom :global(.markdown-details-body) {
    @apply px-3.5 py-3 text-sm leading-relaxed font-normal text-text-secondary;
  }

  .prose-custom :global(details[open] .markdown-details-body) {
    animation: details-expand 300ms cubic-bezier(0.25, 1, 0.5, 1) both;
  }

  .prose-custom :global(.markdown-details-body > :first-child) {
    @apply mt-0!;
  }

  .prose-custom :global(.markdown-details-body > :last-child) {
    @apply mb-0!;
  }

  .prose-custom :global(.markdown-details-body p),
  .prose-custom :global(details p) {
    @apply my-2 text-sm leading-relaxed text-text-secondary;
  }

  .prose-custom :global(.markdown-details-body ul),
  .prose-custom :global(.markdown-details-body ol),
  .prose-custom :global(details ul),
  .prose-custom :global(details ol) {
    @apply my-2 pl-4 text-sm leading-relaxed;
  }

  .prose-custom :global(.markdown-details-body li),
  .prose-custom :global(details li) {
    @apply text-sm leading-relaxed;
  }

  .prose-custom :global(.footnotes) {
    @apply mt-10 border-t border-border-subtle pt-4 text-xs leading-relaxed text-text-secondary sm:text-sm;
  }

  .prose-custom :global(.footnotes ol) {
    @apply my-2 list-decimal space-y-1.5 pl-6;
  }

  .prose-custom :global(.footnotes li p) {
    @apply my-0 inline;
  }

  .prose-custom :global([data-footnote-ref]) {
    @apply text-[0.9em] font-normal text-security no-underline hover:underline;
  }

  .prose-custom :global(.footnotes li) {
    display: list-item;
  }

  .prose-custom :global(.footnotes li::marker) {
    color: var(--color-text-secondary);
  }

  .prose-custom :global([data-footnote-backref]) {
    @apply inline-flex items-center text-security no-underline hover:underline;
    font-size: 0;
    margin-left: 0.25rem;
    vertical-align: baseline;
  }

  .prose-custom :global([data-footnote-backref] + [data-footnote-backref]) {
    margin-left: 0.15rem;
  }

  .prose-custom :global([data-footnote-backref]::before) {
    content: '';
    display: inline-block;
    width: 0.75em;
    height: 0.75em;
    vertical-align: middle;
    background-color: currentColor;
    -webkit-mask: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>')
      center / contain no-repeat;
    mask: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>')
      center / contain no-repeat;
    font-size: 0.75rem;
  }

  .prose-custom :global([data-footnote-backref] sup) {
    @apply font-mono;
    font-size: 0.55rem !important;
    line-height: 1 !important;
    font-weight: 500;
    vertical-align: super;
    margin-left: 0.05rem;
    color: currentColor;
    display: inline-block;
  }

  .prose-custom :global(.footnotes li:target a) {
    @apply underline;
  }
</style>
