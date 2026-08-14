<!-- @format -->
<script lang="ts">
  import {onMount, tick} from 'svelte'
  import {SvelteSet} from 'svelte/reactivity'
  import type {PageProps} from './$types'
  import type {BlogComment} from './+page.server'
  import hljs from 'highlight.js'
  import {isNameReserved} from '$lib/utils/nameValidator'
  import {enhanceCodeBlocks} from '$lib/utils/codeBlocks'
  import {
    turnstileWidget,
    getTurnstileResponse,
    resetTurnstile,
    turnstileSiteKey
  } from '$lib/utils/turnstile'
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
    DropdownTrigger,
    toastStore,
    formatReadTime,
    formatCommentCount,
    formatViewCount,
    Dialog,
    ArticleHeader,
    ShareDialog,
    ArticleMeta,
    HelpfulBlock,
    formatAbsoluteDate,
    Breadcrumb,
    ConsentNotice
  } from '$lib'
  import {pushState} from '$app/navigation'
  import {page} from '$app/state'
  import {supabase} from '$lib/supabase'
  import {themeStore} from '$lib/stores/themeStore.svelte'
  import {sanitizeIconClass} from '$lib/author'

  let {data}: PageProps = $props()
  const post = $derived(data.post)
  const html = $derived(data.html)
  const author = $derived(data.author)

  function copyToClipboard() {
    if (typeof window === 'undefined') return
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        toastStore.success('Copied!')
      })
      .catch(err => {
        console.error(err)
      })
  }

  function triggerToast(message: string) {
    toastStore.show(message)
  }

  let currentPostId = $state<string | null>(null)
  let addedComments = $state<BlogComment[]>([])
  $effect(() => {
    if (currentPostId !== data.post.id) {
      currentPostId = data.post.id
      addedComments = []
    }
  })
  const comments = $derived([...data.comments, ...addedComments])
  const relatedPosts = $derived(data.relatedPosts)
  const failedRelatedBanners = new SvelteSet<string>()
  function markRelatedBannerFailed(postId: string) {
    failedRelatedBanners.add(postId)
  }
  let isDark = $state(false)

  const bannerPublicUrl = $derived(
    data.bannerPublicUrl
      || (data.post.banner_path ?
        supabase.storage.from('blog-posts').getPublicUrl(data.post.banner_path)
          .data.publicUrl
      : '')
  )

  const headings = $derived(data.headings || [])

  let showYesFeedbackDialog = $state(false)
  let showNoFeedbackDialog = $state(false)
  let viewCount = $state<number | null>(null)

  function handleHelpfulness(value: 'yes' | 'no') {
    if (value === 'yes') {
      showYesFeedbackDialog = true
    } else {
      showNoFeedbackDialog = true
    }
  }

  $effect(() => {
    void html

    tick().then(() => {
      const container = document.querySelector('.prose-custom')
      if (container) {
        enhanceCodeBlocks(triggerToast)
        const elements = Array.from(
          container.querySelectorAll('h2, h3')
        ) as HTMLElement[]
        if (elements.length === 0) return

        elements.forEach(el => {
          el.classList.add('group', 'scroll-mt-20', 'cursor-pointer')

          const existingAnchor = el.querySelector('.anchor-link')
          if (existingAnchor) {
            existingAnchor.remove()
          }

          const headingText = el.querySelector('.heading-text')
          if (!headingText) {
            const span = document.createElement('span')
            span.className = 'heading-text'
            while (el.firstChild) {
              span.appendChild(el.firstChild)
            }
            el.appendChild(span)
          }

          const anchor = document.createElement('a')
          anchor.href = `#${el.id}`
          anchor.className = 'anchor-link select-none'
          anchor.innerHTML =
            '<i class="bi bi-link text-[0.85em] leading-none inline-block align-middle select-none opacity-0" aria-hidden="true"></i>'

          el.onclick = async e => {
            e.preventDefault()
            const url = `${window.location.origin}${window.location.pathname}#${el.id}`
            try {
              await navigator.clipboard.writeText(url)
              triggerToast('Subheading link copied to clipboard')
            } catch (err) {
              void err
            }
            const target = document.getElementById(el.id)
            if (target) {
              target.scrollIntoView({behavior: 'smooth', block: 'start'})
              pushState(`#${el.id}`, {})
            }
          }
          el.appendChild(anchor)
        })
      }
    })
  })

  onMount(() => {
    isDark = document.documentElement.classList.contains('dark')

    // Dark/light syntax colors come from the swapped highlight.js stylesheet
    // link below (driven by `isDark`), not from re-tokenizing - the code
    // block markup here has already been restructured into per-line
    // `.code-line` divs by enhanceCodeBlocks. Re-running hljs.highlightAll()
    // reads the elements' textContent, which loses the newlines between
    // those divs and collapses the block to one line while the line-number
    // gutter (built once, not rebuilt) keeps the old row count.
    const observer = new MutationObserver(() => {
      isDark = document.documentElement.classList.contains('dark')
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    hljs.highlightAll()

    ;(async () => {
      try {
        await fetch('/api/internal/blog/views', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({postId: post.id})
        })
        const res = await fetch(
          `/api/v1/blog/views?postId=${encodeURIComponent(post.id)}`
        )
        const data = await res.json()
        viewCount = data.views ?? null
      } catch {
        viewCount = null
      }
    })()

    return () => {
      observer.disconnect()
    }
  })

  let showCopyMenu = $state(false)

  function toggleCopyMenu() {
    showCopyMenu = !showCopyMenu
  }

  async function copyBlogUrl() {
    showCopyMenu = false
    if (typeof window === 'undefined') return
    try {
      await navigator.clipboard.writeText(window.location.href)
      toastStore.success('Copied!')
    } catch {
      toastStore.error('Failed to copy')
    }
  }

  async function copyBlogId() {
    showCopyMenu = false
    try {
      await navigator.clipboard.writeText(data.post.id)
      toastStore.success('Copied!')
    } catch {
      toastStore.error('Failed to copy')
    }
  }

  async function copyBlogMarkdown() {
    showCopyMenu = false
    try {
      const res = await fetch(`/api/v1/blog/${data.post.slug}?format=md`)
      if (res.ok) {
        const mdText = await res.text()
        await navigator.clipboard.writeText(mdText)
        toastStore.success('Copied!')
      } else {
        toastStore.error('Failed to fetch Markdown')
      }
    } catch {
      toastStore.error('Failed to copy')
    }
  }

  let authorName = $state('')
  let isAnonymous = $state(false)
  let commentContent = $state('')
  let replyTo = $state<BlogComment | null>(null)
  let isSubmitting = $state(false)
  let turnstileEl = $state<HTMLDivElement | null>(null)
  let feedbackMessage = $state<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  function getCommentAuthor(comment: BlogComment) {
    return comment.is_anonymous ? 'Anonymous' : comment.author_name
  }

  function getCommentIcon(comment: BlogComment) {
    if (comment.author_name === 'Admin') return 'bi-person-fill-lock'
    return comment.is_anonymous ? 'bi-incognito' : 'bi-person'
  }

  function cancelReply() {
    replyTo = null
    commentContent = ''
    feedbackMessage = null
    errors = {authorName: '', commentContent: ''}
  }

  let errors = $state({authorName: '', commentContent: ''})
  let valid = $state({authorName: false, commentContent: false})

  function debounce<T extends unknown[]>(cb: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>
    return (...args: T) => {
      clearTimeout(timer)
      timer = setTimeout(() => cb(...args), ms)
    }
  }

  const validateAuthorName = debounce(() => {
    if (isAnonymous) {
      valid.authorName = false
      return
    }
    if (authorName.trim() === '') {
      errors.authorName = ''
      valid.authorName = false
    } else if (isNameReserved(authorName)) {
      errors.authorName = 'This name cannot be used. Please use another name.'
      valid.authorName = false
    } else {
      errors.authorName = ''
      valid.authorName = true
    }
  }, 500)

  const validateCommentContent = debounce(() => {
    if (commentContent.trim() === '') {
      errors.commentContent = ''
      valid.commentContent = false
    } else {
      errors.commentContent = ''
      valid.commentContent = true
    }
  }, 500)

  function sanitizeInput(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  function validate() {
    const nameErr =
      !isAnonymous && authorName.trim() === '' ? 'Name is required.' : ''
    const msgErr = commentContent.trim() === '' ? 'Message is required.' : ''
    const nameReservedErr =
      !isAnonymous && !nameErr && isNameReserved(authorName) ?
        'This name cannot be used. Please use another name.'
      : ''

    errors = {authorName: nameErr || nameReservedErr, commentContent: msgErr}
    if (errors.authorName) valid.authorName = false
    if (errors.commentContent) valid.commentContent = false

    return !errors.authorName && !errors.commentContent
  }

  async function handleSubmit(e: SubmitEvent, parentId: string | null = null) {
    e.preventDefault()
    errors = {authorName: '', commentContent: ''}
    if (!validate()) return

    const turnstileToken = getTurnstileResponse(turnstileEl)
    if (!turnstileToken) {
      feedbackMessage = {
        type: 'error',
        text: 'Please complete the verification challenge before submitting.'
      }
      return
    }

    isSubmitting = true
    feedbackMessage = null

    try {
      const res = await fetch('/api/internal/blog/comments', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          postId: post.id,
          parentId,
          authorName: isAnonymous ? '' : sanitizeInput(authorName.trim()),
          isAnonymous,
          content: sanitizeInput(commentContent.trim()),
          turnstileToken
        })
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to submit comment')
      }

      if (result.is_approved) {
        addedComments = [...addedComments, result.comment]
        feedbackMessage = {
          type: 'success',
          text:
            parentId ?
              'Your reply has been posted.'
            : 'Your comment has been posted.'
        }
        commentContent = ''
        replyTo = null
      } else {
        feedbackMessage = {
          type: 'error',
          text: 'Your comment was blocked by AI content moderation (flagged as inappropriate).'
        }
      }
    } catch (err) {
      const error = err as Error
      feedbackMessage = {
        type: 'error',
        text: error.message || 'An error occurred while posting your comment.'
      }
    } finally {
      isSubmitting = false
      resetTurnstile(turnstileEl)
    }
  }

  let siteUrl = $derived(
    (author?.siteUrl || page.url.origin).replace(/\/$/, '')
  )

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
  )
</script>

<svelte:head>
  <title>{post.title}{author?.name ? ` | ${author.name}` : ''}</title>
  <script
    src="https://challenges.cloudflare.com/turnstile/v0/api.js"
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

  {#if isDark}
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" />
  {:else}
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" />
  {/if}
</svelte:head>

<TopNav
  ariaLabel="Article navigation"
  backHref="/#blog"
  backLabel="Back to Blog" />

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
        items={[
          {label: 'Home', href: '/'},
          {label: 'Blog', href: '/#blog'},
          {label: post.title}
        ]}
        class="mb-3" />

      <ArticleHeader
        title={post.title}
        titleViewTransitionName="post-title-{post.slug}">
        {#snippet meta()}
          <div class="flex w-full items-center justify-between gap-2">
            <ArticleMeta
              date={post.created_at}
              updatedAt={post.updated_at}
              readingTime={formatReadTime(post.read_time)}
              commentsCount={comments.length}
              views={viewCount !== null ? viewCount : undefined} />

            <div class="relative z-20 inline-block shrink-0 text-left">
              <DropdownTrigger
                ariaLabel="Copy options menu"
                isOpen={showCopyMenu}
                class="glass-card"
                onclick={toggleCopyMenu}>
                <span class="inline-flex items-center gap-1.5">
                  <i
                    class="bi bi-copy text-xs"
                    aria-hidden="true"></i>
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
                    {#each [{icon: 'bi-link', label: 'Copy Blog URL', onclick: copyBlogUrl}, {icon: 'bi-hash', label: 'Copy Blog ID', onclick: copyBlogId}, {icon: 'bi-markdown-fill', label: 'Copy as Markdown', onclick: copyBlogMarkdown}] as item (item.label)}
                      <button
                        type="button"
                        role="menuitem"
                        onclick={item.onclick}
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover">
                        <i
                          class="bi {item.icon} text-xs"
                          aria-hidden="true"></i>
                        <span>{item.label}</span>
                      </button>
                    {/each}
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

      <div class="prose-custom w-full">
        {@html html}
      </div>

      <div class="mt-12 border-t border-border-subtle pt-8 select-none">
        <h3 class="mb-4 text-sm font-bold tracking-tight text-text-primary">
          Share this article
        </h3>
        <div class="grid w-full grid-cols-5 gap-2">
          <Button
            type="Secondary"
            size="sm"
            leadingIcon="bi-link"
            onclick={copyToClipboard}
            aria-label="Copy URL to clipboard"
            class="w-full justify-center px-1 sm:px-3">
            <span class="truncate">Copy URL</span>
          </Button>
          {#each [{href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(page.url.href)}&text=${encodeURIComponent(post.title)}`, icon: 'bi-twitter-x', label: 'Share on X (opens in a new tab)', text: 'X'}, {href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(page.url.href)}`, icon: 'bi-facebook', label: 'Share on Facebook (opens in a new tab)', text: 'Facebook'}, {href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(page.url.href)}`, icon: 'bi-linkedin', label: 'Share on LinkedIn (opens in a new tab)', text: 'LinkedIn'}, {href: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(page.url.href)}`, icon: 'bi-envelope-fill', label: 'Share via email', text: 'Email'}] as item (item.text)}
            <Button
              href={item.href}
              target={item.href.startsWith('mailto') ? undefined : '_blank'}
              rel="noopener noreferrer"
              type="Secondary"
              size="sm"
              leadingIcon={item.icon}
              aria-label={item.label}
              class="w-full justify-center px-1 sm:px-3">
              <span class="truncate">{item.text}</span>
            </Button>
          {/each}
        </div>
      </div>

      {#if author}
        <Card
          variant="default"
          class="mt-8 flex w-full max-w-full flex-col items-center gap-5 select-none sm:flex-row sm:items-start">
          <ImageWithSkeleton
            src={author.avatar}
            alt={author.name}
            referrerpolicy="no-referrer"
            rounded="rounded-full"
            class="h-20 w-20 shrink-0 border border-border-subtle"
            imgClass="object-top" />
          <div class="w-full min-w-0 flex-1 text-center sm:text-left">
            <h4
              class="px-1 text-base leading-snug font-bold text-text-primary sm:px-0">
              {author.name}
            </h4>
            <p
              class="mt-0.5 px-1 text-xs font-semibold text-text-secondary sm:px-0">
              {author.headline}
            </p>
            <p
              class="mt-3 px-1 text-sm leading-relaxed text-text-secondary/90 sm:px-0">
              {author.bio}
            </p>

            {#if author?.socialLinks && author.socialLinks.length > 0}
              <div
                class="mt-4 flex flex-wrap items-center justify-center gap-2.5 px-1 sm:justify-start sm:gap-4 sm:px-0">
                {#each author.socialLinks as item (item.url + item.platform)}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border-subtle bg-surface-card text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot"
                    aria-label="{item.platform} (opens in a new tab)">
                    <i
                      class="{sanitizeIconClass(
                        item.icon,
                        'bi bi-people'
                      )} flex items-center justify-center text-base leading-none"
                      aria-hidden="true"></i>
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        </Card>
      {/if}

      {#if relatedPosts.length > 0}
        <section
          class="mt-12 border-t border-border-subtle pt-8"
          aria-label="Related posts">
          <h3 class="mb-4 text-sm font-bold tracking-tight text-text-primary">
            Continue reading
          </h3>
          <div class="relative z-0 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {#each relatedPosts as related (related.id)}
              <Card
                class="relative flex h-full w-full flex-col gap-3 text-left">
                {#if related.bannerPublicUrl && !failedRelatedBanners.has(related.id)}
                  <ImageWithSkeleton
                    src={related.bannerPublicUrl}
                    alt={related.title}
                    aspectRatio="aspect-video"
                    fallbackIcon="bi bi-file-richtext-fill"
                    onerror={() => markRelatedBannerFailed(related.id)}
                    class="w-full border border-border-subtle" />
                {:else}
                  <div
                    class="to-palette-purple/15 relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-linear-to-br from-accent/15 select-none">
                    <i
                      class="bi bi-file-richtext-fill text-2xl text-copilot/50"
                      aria-hidden="true"></i>
                  </div>
                {/if}

                <div class="flex flex-1 flex-col gap-1 font-sans">
                  <div
                    class="flex min-h-5 w-full scrollbar-none flex-wrap items-center gap-x-1.5 overflow-x-auto font-sans text-xxs font-medium whitespace-nowrap text-text-muted select-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <RelativeTime date={related.created_at} />
                    <span aria-hidden="true">&middot;</span>
                    <span
                      >Last updated {formatAbsoluteDate(
                        related.updated_at || related.created_at
                      )}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{formatReadTime(related.read_time)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{formatCommentCount(related.comment_count)}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{formatViewCount(related.views_count)}</span>
                  </div>
                  <div class="mt-1">
                    <h4
                      class="text-lg leading-snug font-bold text-text-primary">
                      <a
                        href="/blog/{related.slug}"
                        class="rounded-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-copilot focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card">
                        {related.title}
                      </a>
                    </h4>
                  </div>
                  {#if related.excerpt}
                    <p
                      class="min-h-26 text-sm leading-normal text-text-secondary">
                      {related.excerpt}
                    </p>
                  {/if}

                  <div class="relative z-20 mt-auto flex flex-col gap-2 pt-2">
                    <hr class="border-border-subtle" />
                    <Button
                      href="/blog/{related.slug}"
                      type="Primary"
                      size="md"
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
        <h2 class="mb-8 text-xl font-bold tracking-tight text-text-primary">
          Comments ({comments.length})
        </h2>

        {#if feedbackMessage}
          <StatusBanner
            variant={feedbackMessage.type === 'success' ? 'success' : 'error'}
            message={feedbackMessage.text}
            class="mb-6" />
        {/if}

        {#if !replyTo}
          <Card
            variant="glass"
            class="mb-8 overflow-visible text-left">
            <div class="mb-4 select-none">
              <h3 class="text-sm font-bold text-text-primary">
                Leave a comment
              </h3>
            </div>

            <form
              novalidate
              onsubmit={e => handleSubmit(e)}
              class="flex flex-col gap-2.5">
              <Checkbox
                id="comment-anon"
                label="Comment anonymously"
                bind:checked={isAnonymous}
                aria-describedby="anon-help-main" />
              <span
                id="anon-help-main"
                class="sr-only">
                If checked, your name is hidden and your comment is posted as
                Anonymous.
              </span>
              <FormField
                id="comment-author"
                label="Name"
                required={!isAnonymous}
                error={errors.authorName}
                valid={valid.authorName && !isAnonymous}>
                <Input
                  type="text"
                  id="comment-author"
                  disabled={isAnonymous}
                  aria-required={!isAnonymous}
                  autocomplete="name"
                  aria-invalid={!!errors.authorName}
                  placeholder={isAnonymous ? 'Anonymous' : 'Enter your name'}
                  bind:value={authorName}
                  error={!!errors.authorName}
                  valid={valid.authorName && !isAnonymous}
                  oninput={() => {
                    errors.authorName = ''
                    valid.authorName = false
                    validateAuthorName()
                  }} />
              </FormField>

              <FormField
                id="comment-msg"
                label="Message"
                required
                error={errors.commentContent}
                valid={valid.commentContent}
                counter="{2000 - commentContent.length} left">
                <Textarea
                  id="comment-msg"
                  rows={3}
                  maxlength={2000}
                  placeholder="Write your message…"
                  bind:value={commentContent}
                  error={!!errors.commentContent}
                  valid={valid.commentContent}
                  oninput={() => {
                    errors.commentContent = ''
                    valid.commentContent = false
                    validateCommentContent()
                  }}
                  aria-required="true" />
              </FormField>

              <div
                bind:this={turnstileEl}
                class="cf-turnstile w-full [&_iframe]:border-0!"
                data-action="turnstile-spin-v2"
                use:turnstileWidget={{
                  sitekey: turnstileSiteKey,
                  size: 'flexible'
                }}>
              </div>

              <ConsentNotice action="posting a comment" />

              <div class="mt-2 flex justify-end">
                <Button
                  htmlType="submit"
                  type="Primary"
                  size="md"
                  disabled={isSubmitting}
                  isLoading={isSubmitting}>
                  {isSubmitting ? 'Posting…' : 'Post comment'}
                </Button>
              </div>
            </form>
          </Card>
        {/if}

        {#if comments.length === 0}
          <EmptyState
            icon="bi-chat-square"
            title="No comments yet"
            description="Be the first to share your thoughts on this article." />
        {:else}
          <CommentThread
            {comments}
            {replyTo}
            getIcon={getCommentIcon}>
            {#snippet actions(comment)}
              <RelativeTime
                date={comment.created_at}
                tag="time" />
              <span aria-hidden="true">&middot;</span>
              <button
                type="button"
                onclick={() => {
                  replyTo = comment
                  feedbackMessage = null
                  commentContent = ''
                }}
                class="cursor-pointer font-bold text-text-muted transition-colors hover:text-copilot focus-visible:outline-none">
                Reply
              </button>
            {/snippet}

            {#snippet replyForm(comment)}
              <form
                novalidate
                onsubmit={e => handleSubmit(e, comment.id)}
                class="rounded-sm border border-border-subtle bg-surface-base/60 p-4">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <p class="text-xs font-semibold text-text-secondary">
                    Replying to {getCommentAuthor(comment)}
                  </p>
                  <Button
                    type="Ghost"
                    size="sm"
                    showEscHint
                    onclick={cancelReply}>Cancel</Button>
                </div>

                <div class="flex flex-col gap-4">
                  <Checkbox
                    id="reply-anon-{comment.id}"
                    label="Comment anonymously"
                    bind:checked={isAnonymous}
                    aria-describedby="anon-help-reply-{comment.id}" />
                  <span
                    id="anon-help-reply-{comment.id}"
                    class="sr-only">
                    If checked, your name is hidden and your comment is posted
                    as Anonymous.
                  </span>

                  <FormField
                    id="reply-author-{comment.id}"
                    label="Name"
                    required={!isAnonymous}
                    error={errors.authorName}
                    valid={valid.authorName && !isAnonymous}>
                    <Input
                      type="text"
                      id="reply-author-{comment.id}"
                      disabled={isAnonymous}
                      aria-required={!isAnonymous}
                      autocomplete="name"
                      aria-invalid={!!errors.authorName}
                      placeholder={isAnonymous ? 'Anonymous' : (
                        'Enter your name'
                      )}
                      bind:value={authorName}
                      error={!!errors.authorName}
                      valid={valid.authorName && !isAnonymous}
                      oninput={() => {
                        errors.authorName = ''
                        valid.authorName = false
                        validateAuthorName()
                      }} />
                  </FormField>

                  <FormField
                    id="reply-msg-{comment.id}"
                    label="Message"
                    required
                    error={errors.commentContent}
                    valid={valid.commentContent}
                    counter="{2000 - commentContent.length} left">
                    <Textarea
                      id="reply-msg-{comment.id}"
                      rows={3}
                      maxlength={2000}
                      placeholder="Write your reply…"
                      bind:value={commentContent}
                      error={!!errors.commentContent}
                      valid={valid.commentContent}
                      oninput={() => {
                        errors.commentContent = ''
                        valid.commentContent = false
                        validateCommentContent()
                      }}
                      aria-required="true" />
                  </FormField>

                  <div
                    bind:this={turnstileEl}
                    class="cf-turnstile w-full [&_iframe]:border-0!"
                    data-action="turnstile-spin-v2"
                    use:turnstileWidget={{
                      sitekey: turnstileSiteKey,
                      size: 'flexible'
                    }}>
                  </div>

                  <ConsentNotice action="posting a reply" />

                  <div class="flex justify-end">
                    <Button
                      htmlType="submit"
                      type="Primary"
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

  <FooterSection />
</main>

<ShareDialog
  bind:isOpen={showYesFeedbackDialog}
  title="Share this article?"
  url={page.url.href}
  articleTitle={post.title}
  showEmail
  onClose={() => {
    showYesFeedbackDialog = false
  }} />

<Dialog
  bind:isOpen={showNoFeedbackDialog}
  title="Share your feedback?"
  description="Tell us what we can improve. Your report helps make this article better for everyone."
  onClose={() => {
    showNoFeedbackDialog = false
  }}>
  {#snippet footer()}
    <Button
      type="Secondary"
      size="md"
      showEscHint
      onclick={() => {
        showNoFeedbackDialog = false
      }}>Cancel</Button>
    <Button
      type="Primary"
      size="md"
      onclick={() => {
        showNoFeedbackDialog = false
        window.location.href = '/feedback'
      }}>Send feedback</Button>
  {/snippet}
</Dialog>

<style>
  @reference "../../global.css";

  .prose-custom :global(h1),
  .prose-custom :global(h2),
  .prose-custom :global(h3) {
    @apply font-sans;
  }

  .prose-custom {
    @apply font-sans text-[0.9rem] leading-[1.7] text-(--color-body);
    --color-heading: var(--color-gh-gray-6);
    --color-body: var(--color-gh-gray-5);
    --color-link: var(--color-gh-gray-5);
    --color-link-hover: var(--color-copilot);
  }

  :global(:root.dark) .prose-custom {
    --color-heading: var(--color-gh-gray-1);
    --color-body: var(--color-gh-gray-3);
    --color-link: var(--color-gh-gray-3);
    --color-link-hover: var(--color-copilot);
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
    @apply font-sans text-(--color-heading);
  }

  .prose-custom :global(h1) {
    @apply mt-8 mb-4 text-3xl font-extrabold;
  }

  .prose-custom :global(h2) {
    @apply mt-7 mb-3 text-2xl font-bold;
  }

  .prose-custom :global(h3) {
    @apply mt-6 mb-2 text-xl font-semibold;
  }

  .prose-custom :global(ul) {
    @apply mt-4 mb-4 list-disc pl-6;
  }

  .prose-custom :global(ol) {
    @apply mt-4 mb-4 list-decimal pl-6;
  }

  .prose-custom :global(li) {
    @apply mt-1 mb-1;
  }

  .prose-custom :global(pre) {
    @apply mt-6 mb-6 scrollbar-none! overflow-x-auto rounded-sm border border-adwaita-border bg-adwaita-hover px-3! py-2! font-mono text-[0.8rem] leading-relaxed break-normal! whitespace-pre! [-ms-overflow-style:none]!;
  }

  /* When a line-number gutter sits to the left (see enhanceCodeBlocks), it
     already provides its own edge padding — pre's own left padding on top of
     that doubled the visual gap between the divider and the code text. */
  .prose-custom :global(pre[data-enhanced='true']) {
    @apply pr-3.5! pl-2!;
  }

  .prose-custom :global(pre)::-webkit-scrollbar {
    @apply hidden! h-0! w-0!;
  }

  .prose-custom :global(code:not(pre code)) {
    @apply rounded bg-adwaita-hover px-1 py-px font-mono text-xs font-normal text-inherit;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .prose-custom :global(pre code) {
    @apply block! w-max! min-w-full! overflow-visible! border-0 bg-transparent py-0! pr-3.5! pl-0! font-mono text-[0.8rem] leading-relaxed break-normal! whitespace-pre! text-inherit;
  }

  .prose-custom :global(.code-line) {
    @apply block! w-full! pr-3.5!;
  }

  .prose-custom :global(a:not(.anchor-link)) {
    @apply text-(--color-link) underline transition-colors;
  }

  .prose-custom :global(a:not(.anchor-link):hover) {
    @apply text-(--color-link-hover);
  }

  .prose-custom :global(.heading-text) {
    @apply inline! transition-none!;
  }

  .prose-custom :global(a.anchor-link) {
    @apply ml-[0.35rem]! inline-flex! items-center! justify-center! align-middle! leading-none! whitespace-nowrap! text-adwaita-text! no-underline! transition-none!;
  }

  :global(:root.dark) .prose-custom :global(a.anchor-link) {
    @apply text-gh-gray-4!;
  }

  .prose-custom :global(a.anchor-link .bi) {
    @apply inline-block! align-middle! text-[0.85em]! leading-none! text-inherit! no-underline!;
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
  .prose-custom :global(h1:hover a.anchor-link .bi),
  .prose-custom :global(h2:hover a.anchor-link .bi),
  .prose-custom :global(h3:hover a.anchor-link .bi),
  .prose-custom :global(h4:hover a.anchor-link .bi),
  .prose-custom :global(h5:hover a.anchor-link .bi),
  .prose-custom :global(h6:hover a.anchor-link .bi),
  .prose-custom :global(a.anchor-link):hover :global(.bi),
  :global(:root.dark) .prose-custom :global(h1:hover a.anchor-link .bi),
  :global(:root.dark) .prose-custom :global(h2:hover a.anchor-link .bi),
  :global(:root.dark) .prose-custom :global(h3:hover a.anchor-link .bi),
  :global(:root.dark) .prose-custom :global(h4:hover a.anchor-link .bi),
  :global(:root.dark) .prose-custom :global(h5:hover a.anchor-link .bi),
  :global(:root.dark) .prose-custom :global(h6:hover a.anchor-link .bi),
  :global(:root.dark) .prose-custom :global(a.anchor-link):hover :global(.bi) {
    @apply text-copilot! no-underline! opacity-100;
  }

  .prose-custom :global(table) {
    @apply my-6 w-full max-w-full table-fixed overflow-hidden rounded-sm border border-border-subtle text-left text-xs shadow-2xs;
    border-collapse: separate;
    border-spacing: 0;
  }

  .prose-custom :global(thead) {
    @apply border-b border-border-subtle bg-surface-hover/80 font-semibold tracking-wider text-text-primary uppercase;
  }

  .prose-custom :global(th) {
    @apply px-2.5 py-2 text-center font-semibold text-text-primary;
    overflow-wrap: break-word;
    word-break: break-word;
    width: 1%;
  }

  .prose-custom :global(tbody tr) {
    @apply transition-colors hover:bg-surface-hover/30;
  }

  .prose-custom :global(td) {
    @apply border-r border-border-subtle/40 px-2.5 py-1.5 text-left leading-relaxed text-text-secondary last:border-r-0;
    overflow-wrap: break-word;
    word-break: break-word;
    width: 1%;
  }

  .prose-custom :global(td code),
  .prose-custom :global(th code) {
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
  }

  .prose-custom :global(td[align='right']) {
    @apply text-right;
  }

  .prose-custom :global(td[align='center']) {
    @apply text-center;
  }

  .prose-custom :global(hr) {
    @apply my-8 h-px border-0 bg-border-default;
  }

  .prose-custom :global(blockquote:not(.markdown-alert)) {
    @apply my-6 rounded-l-none rounded-r-sm border-l-2 border-copilot bg-surface-hover/50 py-2.5 pr-4 pl-4 font-sans text-sm leading-relaxed text-text-secondary shadow-2xs;
  }

  .prose-custom :global(blockquote:not(.markdown-alert) p) {
    @apply my-1 text-text-secondary;
  }

  .prose-custom :global(ul:has(input[type='checkbox'])),
  .prose-custom :global(ol:has(input[type='checkbox'])) {
    @apply list-none! pl-0!;
  }

  .prose-custom :global(li:has(input[type='checkbox'])),
  .prose-custom :global(li.task-list-item) {
    @apply flex! list-none! items-center! gap-2.5! pl-0!;
  }

  .prose-custom :global(input[type='checkbox']) {
    appearance: none !important;
    -webkit-appearance: none !important;
    width: 1.125rem !important;
    height: 1.125rem !important;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 0.25rem;
    border: 1px solid var(--color-border-subtle, #30363d);
    background-color: var(--color-surface-base, #0d1117);
    display: inline-grid;
    place-content: center;
    margin: 0;
    vertical-align: middle;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease;
  }

  .prose-custom :global(input[type='checkbox']:checked) {
    background-color: var(--color-copilot, #8534f3) !important;
    border-color: var(--color-copilot, #8534f3) !important;
  }

  .prose-custom :global(input[type='checkbox']:checked::before) {
    content: '';
    width: 0.625rem;
    height: 0.625rem;
    background-color: #ffffff;
    clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
  }

  .prose-custom :global(.markdown-alert) {
    @apply my-6 rounded-r-xl border-l-4 p-4 text-xs shadow-2xs transition-colors duration-200 sm:text-sm;
  }

  .prose-custom :global(.markdown-alert-title) {
    @apply mb-1.5 flex items-center gap-2 text-xs font-bold select-none sm:text-sm;
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
    @apply border-(--color-security) bg-(--color-security-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-note .markdown-alert-title) {
    @apply text-(--color-security);
  }

  .prose-custom :global(.markdown-alert-tip) {
    @apply border-(--color-success) bg-(--color-success-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-tip .markdown-alert-title) {
    @apply text-(--color-success);
  }

  .prose-custom :global(.markdown-alert-important) {
    @apply border-(--color-copilot) bg-(--color-copilot-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-important .markdown-alert-title) {
    @apply text-(--color-copilot);
  }

  .prose-custom :global(.markdown-alert-warning) {
    @apply border-(--color-warning) bg-(--color-warning-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-warning .markdown-alert-title) {
    @apply text-(--color-warning-strong);
  }

  .prose-custom :global(.markdown-alert-caution) {
    @apply border-(--color-danger) bg-(--color-danger-subtle) text-(--color-body);
  }
  .prose-custom :global(.markdown-alert-caution .markdown-alert-title) {
    @apply text-(--color-danger);
  }
</style>
