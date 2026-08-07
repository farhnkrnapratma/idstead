<!-- @format -->
<script lang="ts">
  import './global.css'
  import {onMount} from 'svelte'
  import {fade} from 'svelte/transition'
  import {ConsentBanner, Toast} from '$lib'
  import {page} from '$app/state'
  import {goto} from '$app/navigation'

  import {themeStore} from '$lib/stores/themeStore.svelte'

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

  function handleScroll() {
    showScrollTop = window.scrollY > 300

    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    if (docHeight > 0) {
      scrollProgress = (window.scrollY / docHeight) * 100
    } else {
      scrollProgress = 0
    }
  }

  function scrollToTop() {
    window.scrollTo({top: 0, behavior: 'smooth'})
  }

  onMount(() => {
    const cleanupTheme = themeStore.init()

    window.addEventListener('scroll', handleScroll, {passive: true})
    handleScroll()

    return () => {
      cleanupTheme?.()
      window.removeEventListener('scroll', handleScroll)
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

{#if !isAdminPage}
  <div
    class="pointer-events-none fixed top-15 right-0 left-0 z-[100] h-0.5 w-[var(--scroll-progress-w)] bg-copilot transition-[width] duration-300 ease-out select-none"
    style="--scroll-progress-w: {scrollProgress}%">
  </div>
{/if}

{@render children()}

{#if showScrollTop && !isPostEditorPage}
  <button
    transition:fade={{duration: 150}}
    class="fixed right-4 bottom-4 z-50 inline-flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-sm border border-border-subtle bg-surface-card px-0 text-xs font-semibold text-text-primary shadow-lg transition-all select-none hover:bg-surface-hover hover:text-copilot sm:right-6 sm:bottom-6 sm:w-auto sm:px-4 sm:text-sm"
    onclick={scrollToTop}
    title="Scroll to top"
    aria-label="Scroll to top">
    <i
      class="bi bi-arrow-bar-up text-sm"
      aria-hidden="true"></i>
    <span class="hidden sm:inline">Scroll to top</span>
  </button>
{/if}

{#if isPageWithFeedback}
  <button
    transition:fade={{duration: 150}}
    class="fixed bottom-4 left-4 z-50 inline-flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-sm border border-border-subtle bg-surface-card px-0 text-xs font-semibold text-text-primary shadow-lg transition-all select-none hover:bg-surface-hover hover:text-copilot sm:bottom-6 sm:left-6 sm:w-auto sm:px-4 sm:text-sm"
    onclick={() => goto('/feedback')}
    title="Report an issue or give feedback"
    aria-label="Report an issue or give feedback">
    <i
      class="bi bi-bug-fill text-sm"
      aria-hidden="true"></i>
    <span class="hidden sm:inline">Feedback</span>
  </button>
{/if}

<ConsentBanner />
<Toast />
