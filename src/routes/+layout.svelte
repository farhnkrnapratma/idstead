<!-- @format -->
<script lang="ts">
  import 'bootstrap-icons/font/bootstrap-icons.css'
  import './layout.css'
  import {onMount} from 'svelte'
  import {fade} from 'svelte/transition'
  import ConsentBanner from '$lib/components/ConsentBanner.svelte'
  import {page} from '$app/state'

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
    type="text/plain"
    title="Public API Documentation"
    href="/api/README.md" />
</svelte:head>

{#if !isAdminPage}
  <div
    class="pointer-events-none fixed top-0 right-0 left-0 z-[100] h-1 bg-copilot transition-all duration-75 ease-out select-none"
    style="width: {scrollProgress}%">
  </div>
{/if}

{@render children()}

{#if showScrollTop}
  <button
    transition:fade={{duration: 150}}
    class="fixed right-4 bottom-4 z-50 inline-flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-0 text-xs font-semibold text-text-primary shadow-lg transition-all select-none hover:bg-surface-hover hover:text-copilot sm:right-6 sm:bottom-6 sm:w-auto sm:px-4 sm:text-sm"
    onclick={scrollToTop}
    title="Scroll to top"
    aria-label="Scroll to top">
    <span
      class="material-symbols-rounded text-sm"
      style="font-variation-settings: 'wght' 300, 'opsz' 20;"
      aria-hidden="true">vertical_align_top</span>
    <span class="hidden sm:inline">Scroll to top</span>
  </button>
{/if}

{#if isPageWithFeedback}
  <a
    href="/feedback"
    class="fixed bottom-4 left-4 z-50 inline-flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-0 text-xs font-semibold text-text-primary shadow-lg transition-all select-none hover:bg-surface-hover hover:text-copilot sm:bottom-6 sm:left-6 sm:w-auto sm:px-4 sm:text-sm"
    title="Report an issue or give feedback"
    aria-label="Report an issue or give feedback">
    <span
      class="material-symbols-rounded text-sm"
      style="font-variation-settings: 'wght' 300, 'opsz' 20;"
      aria-hidden="true">chat</span>
    <span class="hidden sm:inline">Feedback</span>
  </a>
{/if}

<ConsentBanner />
