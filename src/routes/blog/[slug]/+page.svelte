<!-- @format -->
<script lang="ts">
  import {onMount, tick} from 'svelte'
  import type {PageProps} from './$types'
  import type {BlogComment} from './+page.server'
  import hljs from 'highlight.js'
  import {isNameReserved} from '$lib/utils/nameValidator'
  import {
    SkipLink,
    SpotlightSearch,
    Button,
    Checkbox,
    CommentThread,
    EmptyState,
    StatusBanner,
    FormField,
    Textarea,
    FooterSection,
    ThemeSelect,
    TableOfContents,
    formatBlogDate,
    formatReadTime,
    formatCommentCount,
    formatViewCount
  } from '$lib'
  import Dialog from '$lib/design-system/components/Dialog.svelte'
  import {pushState} from '$app/navigation'
  import {page} from '$app/state'
  import {supabase} from '$lib/supabase'
  import {themeStore} from '$lib/stores/themeStore.svelte'

  let {data}: PageProps = $props()
  const post = $derived(data.post)
  const html = $derived(data.html)
  const author = $derived(data.author)

  let showCopySuccess = $state(false)

  function copyToClipboard() {
    if (typeof window === 'undefined') return
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        showCopySuccess = true
        setTimeout(() => {
          showCopySuccess = false
        }, 2000)
      })
      .catch(err => {
        console.error(err)
      })
  }

  let toastMessage = $state('')
  let showToast = $state(false)

  function triggerToast(message: string) {
    toastMessage = message
    showToast = true
    setTimeout(() => {
      showToast = false
    }, 2000)
  }

  function getPrettyLanguage(className: string): string {
    if (!className) return 'Code'
    const match = className.match(/language-(\S+)/)
    if (!match) return 'Code'
    const lang = match[1].toLowerCase()
    const map: Record<string, string> = {
      js: 'JavaScript',
      javascript: 'JavaScript',
      ts: 'TypeScript',
      typescript: 'TypeScript',
      html: 'HTML',
      css: 'CSS',
      rust: 'Rust',
      rs: 'Rust',
      python: 'Python',
      py: 'Python',
      bash: 'Bash',
      sh: 'Shell',
      shell: 'Shell',
      json: 'JSON',
      yaml: 'YAML',
      yml: 'YAML',
      xml: 'XML',
      md: 'Markdown',
      markdown: 'Markdown',
      go: 'Go',
      golang: 'Go',
      cpp: 'C++',
      c: 'C',
      csharp: 'C#',
      cs: 'C#',
      sql: 'SQL',
      dockerfile: 'Docker',
      docker: 'Docker'
    }
    return map[lang] || lang.charAt(0).toUpperCase() + lang.slice(1)
  }

  function setupCodeHeaderBars() {
    const container = document.querySelector('.prose-custom')
    if (!container) return
    const preBlocks = container.querySelectorAll('pre')
    preBlocks.forEach(el => {
      const pre = el as HTMLElement
      if (pre.previousElementSibling?.classList.contains('code-header-bar'))
        return

      const codeElement = pre.querySelector('code')
      const langClass = codeElement?.className || ''
      const prettyLang = getPrettyLanguage(langClass)

      const headerBar = document.createElement('div')
      headerBar.className =
        'code-header-bar flex items-center justify-between bg-surface-base/95 border border-border-subtle rounded-t-lg px-4 py-1 text-xs text-text-secondary font-semibold select-none mt-6'

      const leftSpan = document.createElement('span')
      leftSpan.className =
        'text-[12.5px] font-sans font-bold uppercase tracking-wider text-text-secondary leading-none'
      leftSpan.innerText = prettyLang
      headerBar.appendChild(leftSpan)

      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className =
        'flex h-5 w-5 items-center justify-center rounded-md border border-border-subtle/30 hover:bg-surface-hover/30 hover:text-text-primary transition-colors cursor-pointer text-text-secondary leading-none'
      copyBtn.innerHTML =
        '<i class="bi bi-clipboard text-xs" aria-hidden="true"></i>'

      copyBtn.addEventListener('click', () => {
        if (!codeElement) return
        const codeText = codeElement.innerText || codeElement.textContent || ''
        navigator.clipboard
          .writeText(codeText)
          .then(() => {
            copyBtn.innerHTML =
              '<i class="bi bi-clipboard-check text-xs text-copilot" aria-hidden="true"></i>'
            triggerToast('Code copied to clipboard!')
            setTimeout(() => {
              copyBtn.innerHTML =
                '<i class="bi bi-clipboard text-xs" aria-hidden="true"></i>'
            }, 2000)
          })
          .catch(err => {
            console.error('Failed to copy code: ', err)
          })
      })

      headerBar.appendChild(copyBtn)

      pre.style.marginTop = '0px'
      pre.style.borderTopLeftRadius = '0px'
      pre.style.borderTopRightRadius = '0px'
      pre.style.borderTopWidth = '0px'
      pre.style.padding = '10px 12px 10px 12px'

      pre.parentNode?.insertBefore(headerBar, pre)

      // Build 100% custom DOM horizontal scrollbar (matching TOC heading indicator 1-to-1)
      const wrapperBar = document.createElement('div')
      wrapperBar.className =
        'code-scrollbar-wrapper relative w-full px-3 py-1.5 bg-surface-card/80 border-x border-b border-border-subtle rounded-b-lg select-none -mt-6 mb-6 transition-all'

      const trackBar = document.createElement('div')
      trackBar.className =
        'code-scrollbar-track relative w-full h-1 rounded-full bg-border-subtle/50 cursor-pointer overflow-hidden'

      const thumbBar = document.createElement('div')
      thumbBar.className =
        'code-scrollbar-thumb absolute top-0 left-0 h-full rounded-full bg-copilot shadow-xs transition-all duration-75'

      trackBar.appendChild(thumbBar)
      wrapperBar.appendChild(trackBar)

      function updateCustomScrollbar() {
        const scrollLeft = pre.scrollLeft
        const scrollWidth = pre.scrollWidth
        const clientWidth = pre.clientWidth

        if (scrollWidth <= clientWidth + 2) {
          wrapperBar.style.display = 'none'
          pre.style.borderBottomLeftRadius = '0.5rem'
          pre.style.borderBottomRightRadius = '0.5rem'
          pre.style.marginBottom = '1.5rem'
        } else {
          wrapperBar.style.display = 'block'
          pre.style.borderBottomLeftRadius = '0px'
          pre.style.borderBottomRightRadius = '0px'
          pre.style.marginBottom = '0px'

          const thumbRatio = clientWidth / scrollWidth
          const thumbWidthPercent = Math.max(thumbRatio * 100, 12)
          const maxThumbLeft = 100 - thumbWidthPercent
          const maxScroll = scrollWidth - clientWidth
          const thumbLeftPercent =
            maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumbLeft : 0

          thumbBar.style.width = `${thumbWidthPercent}%`
          thumbBar.style.left = `${thumbLeftPercent}%`
        }
      }

      pre.addEventListener('scroll', updateCustomScrollbar, {passive: true})
      window.addEventListener('resize', updateCustomScrollbar)

      trackBar.addEventListener('click', e => {
        const rect = trackBar.getBoundingClientRect()
        const clickRatio = (e.clientX - rect.left) / rect.width
        const maxScroll = pre.scrollWidth - pre.clientWidth
        pre.scrollLeft = clickRatio * maxScroll
      })

      pre.parentNode?.insertBefore(wrapperBar, pre.nextSibling)
      setTimeout(updateCustomScrollbar, 50)
    })
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
  let isDark = $state(false)

  const bannerPublicUrl = $derived(
    data.bannerPublicUrl
      || (data.post.banner_path ?
        supabase.storage.from('blog-posts').getPublicUrl(data.post.banner_path)
          .data.publicUrl
      : '')
  )

  const headings = $derived(data.headings || [])
  let activeHeadingId = $state('')
  let isStretching = $state(false)
  let indicatorTop = $state(0)
  let indicatorHeight = $state(0)
  let isIndicatorVisible = $state(false)
  let tocListEl = $state<HTMLElement | null>(null)

  function updateIndicatorPos(
    headingId: string,
    stretch = false,
    topOverride?: number,
    heightOverride?: number
  ) {
    if (!tocListEl) return
    const targetLink = tocListEl.querySelector<HTMLElement>(
      `a[href="#${headingId}"]`
    )
    if (!targetLink) {
      isIndicatorVisible = false
      return
    }
    isIndicatorVisible = true
    isStretching = stretch

    const baseHeight =
      targetLink.getBoundingClientRect().height || targetLink.offsetHeight

    if (topOverride !== undefined && heightOverride !== undefined) {
      indicatorTop = topOverride
      indicatorHeight = heightOverride
    } else {
      indicatorTop = targetLink.offsetTop
      indicatorHeight = baseHeight
    }
  }

  let helpfulnessFeedback = $state<'yes' | 'no' | null>(null)
  let showYesFeedbackDialog = $state(false)
  let showNoFeedbackDialog = $state(false)
  let viewCount = $state<number | null>(null)

  function handleHelpfulness(value: 'yes' | 'no') {
    helpfulnessFeedback = value
    if (value === 'yes') {
      showYesFeedbackDialog = true
    } else {
      showNoFeedbackDialog = true
    }
  }

  $effect(() => {
    void html
    let headingObserver: IntersectionObserver | null = null
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null
    let lastScrollY = 0

    tick().then(() => {
      const container = document.querySelector('.prose-custom')
      if (container) {
        setupCodeHeaderBars()
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
            '<span class="material-symbols-rounded text-[0.85em] leading-none inline-block align-middle select-none opacity-0" style="font-variation-settings: \'wght\' 400, \'opsz\' 20;" aria-hidden="true">link_2</span>'

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
              activeHeadingId = el.id
              updateIndicatorPos(el.id, false)
            }
          }
          el.appendChild(anchor)
        })

        if (activeHeadingId) {
          updateIndicatorPos(activeHeadingId, false)
        }

        const updateScrollspyPosition = () => {
          if (!tocListEl || elements.length === 0) return
          const scrollY = window.scrollY
          const viewportOffset = 120
          const isScrollingDown = scrollY >= lastScrollY
          lastScrollY = scrollY

          const headingPositions = elements.map(el => {
            const rect = el.getBoundingClientRect()
            return {
              id: el.id,
              top: rect.top + window.scrollY,
              height: rect.height
            }
          })

          const tocLinks = headingPositions.map(h => {
            const link = tocListEl?.querySelector<HTMLElement>(
              `a[href="#${h.id}"]`
            )
            return {
              id: h.id,
              top: link?.offsetTop ?? 0,
              height:
                link ?
                  link.getBoundingClientRect().height || link.offsetHeight
                : 0
            }
          })

          if (
            headingPositions.length > 0
            && scrollY < headingPositions[0].top - viewportOffset
          ) {
            activeHeadingId = ''
            isIndicatorVisible = false
            return
          }

          let segmentIndex = 0
          for (let i = 0; i < headingPositions.length; i++) {
            if (scrollY >= headingPositions[i].top - viewportOffset) {
              segmentIndex = i
            }
          }

          const hCurrent = headingPositions[segmentIndex]
          const hNext = headingPositions[segmentIndex + 1]

          const lCurrent = tocLinks[segmentIndex]
          const lNext = tocLinks[segmentIndex + 1]

          if (!hCurrent || !lCurrent) return

          if (!hNext || !lNext) {
            activeHeadingId = hCurrent.id
            updateIndicatorPos(
              hCurrent.id,
              false,
              lCurrent.top,
              lCurrent.height
            )
            return
          }

          const segDistance = hNext.top - hCurrent.top
          if (segDistance <= 0) {
            activeHeadingId = hCurrent.id
            updateIndicatorPos(
              hCurrent.id,
              false,
              lCurrent.top,
              lCurrent.height
            )
            return
          }

          const rawProgress =
            (scrollY - (hCurrent.top - viewportOffset)) / segDistance
          const progress = Math.max(0, Math.min(1, rawProgress))

          activeHeadingId = progress >= 0.5 ? hNext.id : hCurrent.id

          if (progress > 0.08 && progress < 0.92) {
            const stretchRatio = (progress - 0.08) / 0.84

            if (isScrollingDown) {
              const calcTop = lCurrent.top
              const currentBottom = lCurrent.top + lCurrent.height
              const targetBottom = lNext.top + lNext.height
              const calcBottom =
                currentBottom + (targetBottom - currentBottom) * stretchRatio
              const calcHeight = calcBottom - calcTop
              updateIndicatorPos(activeHeadingId, true, calcTop, calcHeight)
            } else {
              const calcBottom = lNext.top + lNext.height
              const currentTop = lNext.top
              const targetTop = lCurrent.top
              const calcTop =
                currentTop - (currentTop - targetTop) * (1 - stretchRatio)
              const calcHeight = calcBottom - calcTop
              updateIndicatorPos(activeHeadingId, true, calcTop, calcHeight)
            }
          } else {
            const targetLink = progress >= 0.5 ? lNext : lCurrent
            updateIndicatorPos(
              activeHeadingId,
              false,
              targetLink.top,
              targetLink.height
            )
          }

          if (scrollTimeout) clearTimeout(scrollTimeout)
          scrollTimeout = setTimeout(() => {
            if (activeHeadingId) {
              const activeLink = tocLinks.find(l => l.id === activeHeadingId)
              if (activeLink) {
                updateIndicatorPos(
                  activeHeadingId,
                  false,
                  activeLink.top,
                  activeLink.height
                )
              }
            }
          }, 150)
        }

        const handleScroll = () => {
          if (rafId !== null) return
          rafId = requestAnimationFrame(() => {
            rafId = null
            updateScrollspyPosition()
          })
        }

        window.addEventListener('scroll', handleScroll, {passive: true})

        headingObserver = new IntersectionObserver(
          entries => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                activeHeadingId = entry.target.id
                updateIndicatorPos(entry.target.id, false)
              }
            })
          },
          {root: null, rootMargin: '0px 0px -70% 0px', threshold: 0.1}
        )

        elements.forEach(el => headingObserver?.observe(el))

        return () => {
          window.removeEventListener('scroll', handleScroll)
          if (rafId !== null) cancelAnimationFrame(rafId)
          if (scrollTimeout) clearTimeout(scrollTimeout)
          if (headingObserver) headingObserver.disconnect()
        }
      }
    })

    return () => {
      if (headingObserver) {
        headingObserver.disconnect()
      }
    }
  })

  onMount(() => {
    isDark = document.documentElement.classList.contains('dark')

    const observer = new MutationObserver(() => {
      isDark = document.documentElement.classList.contains('dark')
      setTimeout(() => {
        hljs.highlightAll()
      }, 50)
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    hljs.highlightAll()

    ;(async () => {
      try {
        await fetch('/api/views', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({post_id: post.id})
        })
        const res = await fetch(
          `/api/views?post_id=${encodeURIComponent(post.id)}`
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
  let copyToastMsg = $state<string | null>(null)

  function toggleCopyMenu() {
    showCopyMenu = !showCopyMenu
  }

  async function copyBlogId() {
    showCopyMenu = false
    try {
      await navigator.clipboard.writeText(data.post.id)
      copyToastMsg = 'Blog ID copied!'
    } catch {
      copyToastMsg = 'Failed to copy Blog ID'
    }
    setTimeout(() => (copyToastMsg = null), 2000)
  }

  async function copyBlogMarkdown() {
    showCopyMenu = false
    try {
      const res = await fetch(`/api/blog/${data.post.slug}?format=md`)
      if (res.ok) {
        const mdText = await res.text()
        await navigator.clipboard.writeText(mdText)
        copyToastMsg = 'Copied as Markdown!'
      } else {
        copyToastMsg = 'Failed to fetch Markdown'
      }
    } catch {
      copyToastMsg = 'Failed to copy Markdown'
    }
    setTimeout(() => (copyToastMsg = null), 2000)
  }

  let authorName = $state('')
  let isAnonymous = $state(false)
  let commentContent = $state('')
  let replyTo = $state<BlogComment | null>(null)
  let isSubmitting = $state(false)
  let feedbackMessage = $state<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  function getCommentAuthor(comment: BlogComment) {
    return comment.is_anonymous ? 'Anonymous' : comment.author_name
  }

  function getCommentIcon(comment: BlogComment) {
    if (comment.author_name === 'Admin') return 'person_shield'
    return comment.is_anonymous ? 'domino_mask' : 'person'
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

    isSubmitting = true
    feedbackMessage = null

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          postId: post.id,
          parentId,
          authorName: isAnonymous ? '' : sanitizeInput(authorName.trim()),
          isAnonymous,
          content: sanitizeInput(commentContent.trim())
        })
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.message || 'Failed to submit comment')
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
    }
  }

  let jsonLdScript = $derived(
    '<script type="application/ld+json">'
      + JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt || post.title,
        url: 'https://fkp.my.id/blog/' + post.slug,
        datePublished: post.created_at,
        author: {
          '@type': 'Person',
          name: author?.name || '',
          url: author?.siteUrl || 'https://fkp.my.id'
        }
      })
      + '</'
      + 'script>'
  )
</script>

<svelte:head>
  <title>{post.title}{author?.name ? ` | ${author.name}` : ''}</title>
  {#if post.excerpt}
    <meta
      name="description"
      content={post.excerpt} />
  {/if}
  <link
    rel="canonical"
    href={'https://fkp.my.id/blog/' + post.slug} />
  {@html jsonLdScript}

  <meta
    property="og:type"
    content="article" />
  <meta
    property="og:url"
    content={'https://fkp.my.id/blog/' + post.slug} />
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
    content={'https://fkp.my.id/blog/' + post.slug} />
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

<SkipLink />

<nav
  class="fixed top-0 z-40 flex h-15 w-full items-center justify-between border-b border-border-subtle bg-surface-card/60 px-3 font-sans shadow-xs backdrop-blur-lg transition-colors duration-300 sm:px-5"
  aria-label="Article navigation">
  <a
    href="/#blog"
    class="inline-flex h-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-card px-4 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none">
    Back to Blog
  </a>
  <div class="flex items-center gap-2">
    <SpotlightSearch />
    <ThemeSelect
      theme={themeStore.current}
      onThemeChange={themeStore.apply}
      class="hidden md:inline-flex" />
  </div>
</nav>

<main
  id="main-content"
  class="flex min-h-[calc(100vh-3.75rem)] flex-col pt-15 font-sans">
  <div
    class="relative mx-auto w-full max-w-7xl px-6 pt-9 pb-16 xl:grid xl:grid-cols-12 xl:gap-8">
    <article
      class="mx-auto flex w-full flex-col pt-4 md:w-[80%] lg:w-[50%] xl:col-span-6 xl:col-start-4 xl:mx-0 xl:w-auto">
      <header class="border-b border-b-border-subtle">
        <h1
          class="blog-title font normal font-serif text-5xl leading-tight tracking-tight text-text-primary md:text-5xl">
          {post.title}
        </h1>
        <div class="relative mb-3 rounded-md bg-copilot/5 py-3 pr-2.5 pl-5">
          <div class="absolute top-0 left-0 h-full w-2 rounded-l-md bg-copilot">
          </div>
          <div>
            {#if post.excerpt}
              <div class="text-sm leading-relaxed text-text-secondary">
                {post.excerpt}
              </div>
            {/if}
            <div
              class="no-scrollbar mt-4 flex w-full items-center justify-between gap-2 font-sans text-xs font-semibold whitespace-nowrap text-text-muted select-none">
              <div class="flex items-center gap-x-1.5 overflow-x-auto">
                <time datetime={post.created_at}
                  >{formatBlogDate(post.created_at)}</time>
                <span aria-hidden="true">&middot;</span>
                <span>{formatReadTime(post.read_time)}</span>
                <span aria-hidden="true">&middot;</span>
                <span>{formatCommentCount(comments.length)}</span>
                {#if viewCount !== null}
                  <span aria-hidden="true">&middot;</span>
                  <span>{formatViewCount(viewCount)}</span>
                {/if}
              </div>

              <div class="relative inline-block shrink-0 text-left">
                <button
                  type="button"
                  onclick={toggleCopyMenu}
                  class="inline-flex items-center gap-1 rounded border border-border-subtle/80 bg-surface-card/80 px-2 py-0.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-copilot/50 hover:bg-surface-hover hover:text-copilot focus:outline-none"
                  aria-label="Copy options menu">
                  {#if copyToastMsg}
                    <i
                      class="bi bi-clipboard-check text-[11px] text-copilot"
                      aria-hidden="true"></i>
                    <span class="font-semibold text-copilot"
                      >{copyToastMsg}</span>
                  {:else}
                    <i
                      class="bi bi-clipboard text-[11px]"
                      aria-hidden="true"></i>
                    <span>Copy</span>
                    <i
                      class="bi bi-chevron-down text-[9px] opacity-70"
                      aria-hidden="true"></i>
                  {/if}
                </button>

                {#if showCopyMenu}
                  <div
                    class="absolute right-0 z-50 mt-1 w-40 rounded-lg border border-border-subtle bg-surface-card p-1 shadow-lg backdrop-blur-md">
                    <button
                      type="button"
                      onclick={copyBlogId}
                      class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] font-medium text-text-primary transition-colors hover:bg-surface-hover hover:text-copilot">
                      <i
                        class="bi bi-hash text-xs text-copilot"
                        aria-hidden="true"></i>
                      <span>Copy Blog ID</span>
                    </button>
                    <button
                      type="button"
                      onclick={copyBlogMarkdown}
                      class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] font-medium text-text-primary transition-colors hover:bg-surface-hover hover:text-copilot">
                      <i
                        class="bi bi-markdown text-xs text-copilot"
                        aria-hidden="true"></i>
                      <span>Copy as Markdown</span>
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </header>

      <TableOfContents
        {headings}
        class="mt-3 xl:hidden" />

      <div class="prose-custom w-full">
        {@html html}
      </div>

      <div
        class="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border-subtle pt-8 select-none sm:flex-row">
        <div>
          <h3 class="text-sm font-bold text-text-primary">
            Was this article helpful?
          </h3>
          <p class="mt-0.5 text-xs text-text-secondary">
            Help us improve by letting us know your thoughts.
          </p>
        </div>
        <div class="flex items-center gap-3">
          {#if helpfulnessFeedback === null}
            <Button
              variant="secondary"
              size="sm"
              onclick={() => handleHelpfulness('yes')}>
              <span
                class="material-symbols-rounded text-sm leading-none select-none"
                style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                aria-hidden="true">thumb_up</span>
              <span>Yes</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onclick={() => handleHelpfulness('no')}>
              <span
                class="material-symbols-rounded text-sm leading-none select-none"
                style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                aria-hidden="true">thumb_down</span>
              <span>No</span>
            </Button>
          {:else if helpfulnessFeedback === 'yes'}
            <span
              class="flex animate-pulse items-center gap-1.5 text-xs font-bold text-copilot">
              <i
                class="bi bi-heart-fill"
                aria-hidden="true"></i> Thank you for your feedback!
            </span>
          {:else}
            <span
              class="flex items-center gap-1.5 text-xs font-bold text-text-muted">
              <i
                class="bi bi-emoji-neutral"
                aria-hidden="true"></i> Redirecting to feedback…
            </span>
          {/if}
        </div>
      </div>

      <div class="mt-12 border-t border-border-subtle pt-8 select-none">
        <h3 class="mb-4 text-sm font-bold tracking-tight text-text-primary">
          Share this article
        </h3>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button
            onclick={copyToClipboard}
            class="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-4 text-xs font-semibold text-text-primary transition-colors select-none hover:bg-surface-hover hover:text-copilot"
            aria-label="Copy link to clipboard">
            {#if showCopySuccess}
              <i
                class="bi bi-check2 text-success"
                aria-hidden="true"></i>
            {:else}
              <span
                class="material-symbols-rounded text-base leading-none select-none"
                style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                aria-hidden="true">link_2</span>
            {/if}
            <span class="hidden sm:inline"
              >{showCopySuccess ? 'Copied!' : 'Copy link'}</span>
          </button>
          {#each [{href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(page.url.href)}&text=${encodeURIComponent(post.title)}`, icon: 'bi-twitter-x', label: 'Share on X (opens in a new tab)', text: 'X'}, {href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(page.url.href)}`, icon: 'bi-facebook', label: 'Share on Facebook (opens in a new tab)', text: 'Facebook'}, {href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(page.url.href)}`, icon: 'bi-linkedin', label: 'Share on LinkedIn (opens in a new tab)', text: 'LinkedIn'}, {href: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(page.url.href)}`, icon: 'bi-envelope-at', label: 'Share via email', text: 'Email'}] as item (item.text)}
            <a
              href={item.href}
              target={item.href.startsWith('mailto') ? undefined : '_blank'}
              rel="noopener noreferrer"
              class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-4 text-xs font-semibold text-text-primary transition-colors select-none hover:bg-surface-hover hover:text-copilot"
              aria-label={item.label}>
              <i
                class="bi {item.icon}"
                aria-hidden="true"></i>
              <span class="hidden sm:inline">{item.text}</span>
            </a>
          {/each}
        </div>
      </div>

      {#if author}
        <div
          class="mt-8 flex w-full max-w-full flex-col items-center gap-5 overflow-hidden rounded-md border border-border-subtle bg-surface-card/45 p-5 shadow-xs backdrop-blur-lg select-none sm:flex-row sm:items-start sm:p-6">
          <div
            class="relative h-20 w-20 shrink-0 animate-pulse overflow-hidden rounded-full border border-border-subtle bg-surface-card/60">
            <img
              src={author.avatar}
              alt={author.name}
              loading="lazy"
              onload={e =>
                (
                  e.currentTarget.closest(
                    '.animate-pulse'
                  ) as HTMLElement | null
                )?.classList.remove('animate-pulse')}
              class="h-full w-full object-cover object-top" />
          </div>
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

            <div
              class="mt-4 flex flex-wrap items-center justify-center gap-2.5 px-1 sm:justify-start sm:gap-4 sm:px-0">
              <a
                href="https://github.com/farhnkrnapratma"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-card text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot"
                aria-label="GitHub (opens in a new tab)">
                <i
                  class="bi bi-github flex items-center justify-center text-base leading-none"
                  aria-hidden="true"></i>
              </a>
              <a
                href="https://linkedin.com/in/farhnkrnapratma"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-card text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot"
                aria-label="LinkedIn (opens in a new tab)">
                <i
                  class="bi bi-linkedin flex items-center justify-center text-base leading-none"
                  aria-hidden="true"></i>
              </a>
              <a
                href="https://x.com/farhnkrnapratma"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-card text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot"
                aria-label="X (opens in a new tab)">
                <i
                  class="bi bi-twitter-x flex items-center justify-center text-base leading-none"
                  aria-hidden="true"></i>
              </a>
              <a
                href="https://facebook.com/farhnkrnapratma"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-card text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot"
                aria-label="Facebook (opens in a new tab)">
                <i
                  class="bi bi-facebook flex items-center justify-center text-base leading-none"
                  aria-hidden="true"></i>
              </a>
              <a
                href="https://instagram.com/farhnkrnapratma"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-card text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot"
                aria-label="Instagram (opens in a new tab)">
                <i
                  class="bi bi-instagram flex items-center justify-center text-base leading-none"
                  aria-hidden="true"></i>
              </a>
              <a
                href="https://threads.net/@farhnkrnapratma"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-card text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot"
                aria-label="Threads (opens in a new tab)">
                <i
                  class="bi bi-threads flex items-center justify-center text-base leading-none"
                  aria-hidden="true"></i>
              </a>
            </div>
          </div>
        </div>
      {/if}

      <section
        class="mt-16 border-t border-border-subtle pt-10"
        aria-label="Comments">
        <h2 class="mb-8 text-xl font-bold tracking-tight text-text-primary">
          Comments ({comments.length})
        </h2>

        {#if feedbackMessage}
          <StatusBanner
            type={feedbackMessage.type === 'success' ? 'success' : 'error'}
            message={feedbackMessage.text}
            class="mb-6" />
        {/if}

        {#if !replyTo}
          <div
            class="mb-8 rounded-2xl border border-border-subtle bg-surface-card/45 p-5 text-left shadow-xs backdrop-blur-lg transition-colors duration-300">
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
              <div class="flex flex-col gap-1">
                <label
                  for="comment-author"
                  class="text-xs font-bold text-text-primary select-none">
                  Name {#if !isAnonymous}<span
                      aria-hidden="true"
                      class="text-danger">*</span
                    ><span class="sr-only">(required)</span>{/if}
                </label>
                <div class="w-full">
                  <input
                    type="text"
                    id="comment-author"
                    disabled={isAnonymous}
                    aria-required={!isAnonymous}
                    autocomplete="name"
                    aria-invalid={!!errors.authorName}
                    aria-describedby="comment-author-fb"
                    placeholder={isAnonymous ? 'Anonymous' : 'Enter your name'}
                    bind:value={authorName}
                    oninput={() => {
                      errors.authorName = ''
                      valid.authorName = false
                      validateAuthorName()
                    }}
                    class="w-full rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm text-text-primary transition-colors placeholder:text-text-muted/70 disabled:opacity-60"
                    class:border-danger={errors.authorName}
                    class:input-valid={valid.authorName && !isAnonymous} />
                  <div
                    id="comment-author-fb"
                    aria-live="polite"
                    class="mt-1 h-4 text-xs leading-none font-medium">
                    {#if errors.authorName}
                      <span
                        role="alert"
                        class="flex items-center gap-1 text-danger">
                        <i
                          class="bi bi-exclamation-circle-fill"
                          aria-hidden="true"></i
                        >{errors.authorName}
                      </span>
                    {:else if valid.authorName && !isAnonymous}
                      <span class="flex items-center gap-1 text-copilot">
                        <i
                          class="bi bi-check-circle-fill"
                          aria-hidden="true"></i
                        >Looks good
                      </span>
                    {/if}
                  </div>
                </div>
              </div>

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

              <div class="mt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
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
            icon="bi-chat-square"
            title="No comments yet"
            description="Be the first to share your thoughts on this article." />
        {:else}
          <CommentThread
            {comments}
            {replyTo}
            getIcon={getCommentIcon}>
            {#snippet actions(comment)}
              <time datetime={comment.created_at}
                >{formatBlogDate(comment.created_at)}</time>
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
                class="rounded-xl border border-border-subtle bg-surface-base/60 p-4">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <p class="text-xs font-semibold text-text-secondary">
                    Replying to {getCommentAuthor(comment)}
                  </p>
                  <Button
                    variant="ghost"
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

                  <div class="flex flex-col gap-1">
                    <label
                      for="reply-author-{comment.id}"
                      class="text-xs font-bold text-text-primary select-none">
                      Name {#if !isAnonymous}<span
                          aria-hidden="true"
                          class="text-danger">*</span
                        ><span class="sr-only">(required)</span>{/if}
                    </label>
                    <div class="w-full">
                      <input
                        type="text"
                        id="reply-author-{comment.id}"
                        disabled={isAnonymous}
                        aria-required={!isAnonymous}
                        autocomplete="name"
                        aria-invalid={!!errors.authorName}
                        aria-describedby="reply-author-fb-{comment.id}"
                        placeholder={isAnonymous ? 'Anonymous' : (
                          'Enter your name'
                        )}
                        bind:value={authorName}
                        oninput={() => {
                          errors.authorName = ''
                          valid.authorName = false
                          validateAuthorName()
                        }}
                        class="w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-1.5 text-sm text-text-primary transition-colors placeholder:text-text-muted/70 disabled:opacity-60"
                        class:border-danger={errors.authorName}
                        class:input-valid={valid.authorName && !isAnonymous} />
                      <div
                        id="reply-author-fb-{comment.id}"
                        aria-live="polite"
                        class="mt-1 h-4 text-xs leading-none font-medium">
                        {#if errors.authorName}
                          <span
                            role="alert"
                            class="flex items-center gap-1 text-danger">
                            <i
                              class="bi bi-exclamation-circle-fill"
                              aria-hidden="true"></i
                            >{errors.authorName}
                          </span>
                        {:else if valid.authorName && !isAnonymous}
                          <span class="flex items-center gap-1 text-copilot">
                            <i
                              class="bi bi-check-circle-fill"
                              aria-hidden="true"></i
                            >Looks good
                          </span>
                        {/if}
                      </div>
                    </div>
                  </div>

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

                  <div class="flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
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

    <aside
      class="sticky top-24 hidden h-fit self-start select-none xl:col-span-3 xl:col-start-10 xl:block"
      aria-label="Table of contents">
      <TableOfContents {headings} />
    </aside>
  </div>

  <FooterSection />
</main>

{#if showToast}
  <div
    role="status"
    aria-live="polite"
    class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border-subtle bg-surface-card/90 px-4 py-2 text-xs font-semibold text-text-primary shadow-lg backdrop-blur-md transition-all duration-300">
    <i
      class="bi bi-check-circle-fill text-sm text-copilot"
      aria-hidden="true"></i>
    {toastMessage}
  </div>
{/if}

<Dialog
  bind:isOpen={showYesFeedbackDialog}
  title="Share this article?"
  description="Great to hear it helped! Share it with your peers:"
  onClose={() => {
    showYesFeedbackDialog = false
    helpfulnessFeedback = null
  }}>
  <div class="grid grid-cols-2 gap-2 text-left">
    <button
      onclick={() => {
        copyToClipboard()
        showYesFeedbackDialog = false
      }}
      class="col-span-2 flex h-9.5 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover hover:text-copilot">
      {#if showCopySuccess}
        <i
          class="bi bi-check2 text-sm text-success"
          aria-hidden="true"></i>
      {:else}
        <span
          class="material-symbols-rounded text-base leading-none select-none"
          style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
          aria-hidden="true">link_2</span>
      {/if}
      <span>{showCopySuccess ? 'Copied!' : 'Copy link'}</span>
    </button>
    {#each [{href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(page.url.href)}&text=${encodeURIComponent(post.title)}`, icon: 'bi-twitter-x', text: 'X'}, {href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(page.url.href)}`, icon: 'bi-linkedin', text: 'LinkedIn'}, {href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(page.url.href)}`, icon: 'bi-facebook', text: 'Facebook'}, {href: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(page.url.href)}`, icon: 'bi-envelope-at', text: 'Email'}] as item (item.text)}
      <a
        href={item.href}
        target={item.href.startsWith('mailto') ? undefined : '_blank'}
        rel="noopener noreferrer"
        onclick={() => (showYesFeedbackDialog = false)}
        class="flex h-9.5 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover hover:text-copilot">
        <i
          class="bi {item.icon} text-sm"
          aria-hidden="true"></i>
        <span>{item.text}</span>
      </a>
    {/each}
  </div>
  {#snippet footer()}
    <Button
      variant="secondary"
      size="md"
      showEscHint
      onclick={() => {
        showYesFeedbackDialog = false
        helpfulnessFeedback = null
      }}>Cancel</Button>
  {/snippet}
</Dialog>

<Dialog
  bind:isOpen={showNoFeedbackDialog}
  title="Share your feedback?"
  description="Tell us what we can improve. Your report helps make this article better for everyone."
  onClose={() => {
    showNoFeedbackDialog = false
    helpfulnessFeedback = null
  }}>
  {#snippet footer()}
    <Button
      variant="secondary"
      size="md"
      showEscHint
      onclick={() => {
        showNoFeedbackDialog = false
        helpfulnessFeedback = null
      }}>Cancel</Button>
    <Button
      variant="primary"
      size="md"
      onclick={() => {
        showNoFeedbackDialog = false
        window.location.href = '/feedback'
      }}>Send feedback</Button>
  {/snippet}
</Dialog>
