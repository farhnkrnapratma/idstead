<!-- @format -->
<script lang="ts">
  import './global.css'
  import {onMount} from 'svelte'
  import {page} from '$app/state'
  import {ConsentBanner, Toast, ScrollToTopButton, FeedbackButton} from '$lib'

  import {themeStore} from '$lib/stores/themeStore.svelte'
  import {a11yStore} from '$lib/stores/a11yStore.svelte'

  const {data, children} = $props()

  let name = $derived(data?.author?.name || '')
  let siteUrl = $derived(
    (data?.author?.siteUrl || 'https://fkp.my.id').replace(/\/$/, '')
  )

  let feedTitle = $derived(
    name ?
      `${name} (${siteUrl}/blog) — RSS Feed`
    : `${siteUrl.replace(/^https?:\/\//, '')}/blog — RSS Feed`
  )

  let showScrollTop = $state(false)
  let scrollProgress = $state(0)

  const isAdminPage = $derived(page.url.pathname.startsWith('/admin'))
  const isPostEditorPage = $derived(page.url.pathname === '/admin/new')
  const isPageWithFeedback = $derived(
    !page.error
      && page.url.pathname !== '/feedback'
      && !page.url.pathname.startsWith('/admin')
  )
  const showScrollIndicator = $derived(!isAdminPage && !page.error)

  function handleScroll() {
    showScrollTop = window.scrollY > 300

    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    if (docHeight > 0) {
      scrollProgress = (window.scrollY / docHeight) * 100
    } else {
      scrollProgress = 0
    }
  }

  onMount(() => {
    const cleanupTheme = themeStore.init()
    const cleanupA11y = a11yStore.init()
    handleScroll()
    return () => {
      cleanupTheme?.()
      cleanupA11y?.()
    }
  })
</script>

<svelte:head>
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
    title="Public API Documentation"
    href="/api/v1" />
</svelte:head>

<svelte:window onscroll={handleScroll} />

{#if showScrollIndicator}
  <div
    class="pointer-events-none fixed top-15 right-0 left-0 z-40 h-0.5 w-(--scroll-progress-w) bg-copilot transition-[width] duration-300 ease-out select-none"
    style="--scroll-progress-w: {scrollProgress}%">
  </div>
{/if}

{@render children()}

<ScrollToTopButton show={showScrollTop && !isAdminPage} />
<FeedbackButton show={isPageWithFeedback} />

<ConsentBanner />
<Toast />
