<script lang="ts">
  import {goto} from '$app/navigation'
  import {
    Search,
    FileText,
    ArrowRight,
    ExternalLink,
    ArrowUpDown,
    CornerDownLeft
  } from '@lucide/svelte'
  import type {Project} from '$lib/types'
  import {cn} from '../utils/cn'
  import {decodeHtmlEntities} from '../utils/formatters'

  interface SearchResult {
    type: 'post' | 'project'
    title: string
    subtitle: string
    url: string
    tags?: string[]
  }

  interface Props {
    projects?: Project[]
    class?: string
  }

  let {projects = [], class: className = ''}: Props = $props()

  let isOpen = $state(false)
  let query = $state('')
  let results = $state<SearchResult[]>([])
  let activeIndex = $state(-1)
  let isLoading = $state(false)
  let inputEl = $state<HTMLInputElement | null>(null)
  let listEl = $state<HTMLUListElement | null>(null)

  let debounceTimer: ReturnType<typeof setTimeout>

  function searchProjects(q: string): SearchResult[] {
    const lower = q.toLowerCase()
    return projects
      .filter(
        p =>
          p.name.toLowerCase().includes(lower)
          || p.desc.toLowerCase().includes(lower)
          || p.tags.some(t => t.toLowerCase().includes(lower))
      )
      .slice(0, 4)
      .map(p => ({
        type: 'project' as const,
        title: p.name,
        subtitle: p.desc,
        url: p.url,
        tags: p.tags.slice(0, 3)
      }))
  }

  async function runSearch(q: string) {
    if (q.length < 2) {
      results = []
      isLoading = false
      return
    }

    isLoading = true
    activeIndex = -1

    const projectMatches = searchProjects(q)

    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      const postResults: SearchResult[] = data.data ?? []
      results = [...postResults, ...projectMatches]
    } catch {
      results = projectMatches
    }

    isLoading = false
  }

  function handleInput() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      runSearch(query)
    }, 250)
  }

  let previouslyFocusedElement = $state<HTMLElement | null>(null)

  function open() {
    if (typeof document !== 'undefined') {
      previouslyFocusedElement = document.activeElement as HTMLElement
    }
    isOpen = true
    query = ''
    results = []
    activeIndex = -1
    setTimeout(() => inputEl?.focus(), 30)
  }

  function close() {
    isOpen = false
    query = ''
    results = []
    activeIndex = -1
    if (previouslyFocusedElement) {
      setTimeout(() => {
        previouslyFocusedElement?.focus()
        previouslyFocusedElement = null
      }, 30)
    }
  }

  function select(result: SearchResult) {
    close()
    if (result.url.startsWith('http')) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } else {
      goto(result.url)
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        activeIndex = Math.min(activeIndex + 1, results.length - 1)
        scrollActiveIntoView()
        break
      case 'ArrowUp':
        e.preventDefault()
        activeIndex = Math.max(activeIndex - 1, -1)
        scrollActiveIntoView()
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && results[activeIndex]) {
          select(results[activeIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }

  function scrollActiveIntoView() {
    if (!listEl || activeIndex < 0) return
    const items = listEl.querySelectorAll('[data-result-item]')
    items[activeIndex]?.scrollIntoView({block: 'nearest'})
  }

  function handleResultKeydown(e: KeyboardEvent, result: SearchResult) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(result)
    }
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (isOpen && e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
      (e.target as HTMLElement)?.tagName
    )
    if ((e.ctrlKey && e.key === 'k') || (!inInput && e.key === '/')) {
      e.preventDefault()
      if (isOpen) {
        close()
      } else {
        open()
      }
    }
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node)
        }
      }
    }
  }

  $effect(() => {
    if (isOpen && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  })

  function escapeHtml(unsafe: string) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function highlight(text: string, q: string): string {
    const safeText = escapeHtml(text || '')
    if (!q || q.length < 2) return safeText
    const safeQ = escapeHtml(q)
    const escaped = safeQ.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\___SVELTE_BLOCK_0___'
    )
    return safeText.replace(
      new RegExp(`(${escaped})`, 'gi'),
      '<mark class="bg-copilot/20 text-copilot rounded-[2px] px-[1px] not-italic font-semibold">$1</mark>'
    )
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="group relative inline-flex">
  <button
    type="button"
    onclick={open}
    class={cn(
      'flex h-9 cursor-pointer items-center justify-center gap-2 rounded-sm glass-button px-3 text-xs font-semibold text-text-secondary hover:border-copilot/50 hover:text-copilot',
      className
    )}
    aria-label="Open spotlight search (Ctrl+K)">
    <Search class="size-4" />
    <span class="hidden sm:inline">Search</span>
    <kbd
      class="ml-1.5 hidden h-5 items-center justify-center rounded-sm border border-border-subtle/80 bg-surface-base/80 px-1.5 align-middle font-mono text-xxs leading-none font-semibold text-text-secondary sm:inline-flex">
      Ctrl+K
    </kbd>
  </button>

  <div
    role="tooltip"
    class="pointer-events-none absolute top-[calc(100%+6px)] left-1/2 z-70 -translate-x-1/2 rounded-sm glass-overlay px-2 py-1 text-3xs font-medium whitespace-nowrap text-text-primary opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 sm:hidden">
    <span class="relative z-10">Search (Ctrl+K)</span>
  </div>
</div>

{#if isOpen}
  <div
    use:portal
    class="fixed inset-0 z-99999 flex items-center justify-center p-4">
    <button
      type="button"
      class="fixed inset-0 cursor-default bg-black/60 backdrop-blur-md transition-all duration-300"
      aria-label="Close search"
      onclick={close}></button>

    <div
      class="relative z-10 flex h-[60vh] max-h-[60vh] min-h-[60vh] w-full max-w-xl flex-col overflow-hidden rounded-sm glass-overlay"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Spotlight Search"
      onkeydown={handleKeydown}>
      <div class="flex-none border-b border-border-subtle/50 px-4 py-2">
        <div
          class="flex items-center gap-3 rounded-sm border border-border-subtle/70 bg-surface-card/85 px-3.5 py-2.5 backdrop-blur-xs transition-all duration-150 focus-within:border-copilot/60 focus-within:bg-surface-card focus-within:ring-1 focus-within:ring-copilot/20 dark:border-white/10 dark:bg-surface-card/70 dark:focus-within:bg-surface-card/90">
          {#if isLoading}
            <svg
              class="h-4 w-4 shrink-0 animate-spin text-copilot"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true">
              <circle
                class="stroke-copilot stroke-3 opacity-25"
                cx="12"
                cy="12"
                r="10">
              </circle>
              <path
                class="fill-copilot stroke-copilot opacity-25"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          {:else}
            <Search class="size-4 shrink-0 text-text-secondary" />
          {/if}

          <input
            bind:this={inputEl}
            bind:value={query}
            oninput={handleInput}
            type="search"
            id="spotlight-search-input"
            name="q"
            spellcheck="false"
            autocomplete="off"
            placeholder="Search posts & projects…"
            class="search-input w-full bg-transparent text-sm font-semibold text-text-primary placeholder:font-medium placeholder:text-text-muted focus:outline-none"
            aria-label="Search query"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-activedescendant={activeIndex >= 0 ?
              `result-${activeIndex}`
            : undefined} />

          <button
            type="button"
            onclick={close}
            class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none"
            aria-label="Close search">
            <span>Cancel</span>
            <kbd
              class="hidden h-4.5 items-center justify-center rounded-sm border border-border-subtle bg-surface-card px-1.5 font-mono text-3xs leading-none text-text-muted select-none sm:inline-flex">
              Esc
            </kbd>
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        {#if query.length < 2}
          <div
            class="flex h-full flex-col items-center justify-center gap-2 px-4 py-8 text-center select-none">
            <Search class="size-8 text-text-muted/30" />
            <p class="text-xs text-text-muted">
              Start typing to search posts & projects
            </p>
          </div>
        {:else if isLoading}
          <div class="space-y-2 p-3">
            {#each [1, 2, 3] as _, i (i)}
              <div
                class="flex animate-pulse items-center gap-3 rounded-sm border border-border-subtle bg-surface-hover p-3 select-none">
                <div class="h-5 w-5 shrink-0 rounded-xs bg-border-default">
                </div>
                <div class="flex-1 space-y-1.5">
                  <div class="h-3.5 w-2/5 rounded bg-border-default"></div>
                  <div class="h-2.5 w-4/5 rounded bg-border-subtle"></div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          {#if results.length === 0}
            <div
              class="flex h-full flex-col items-center justify-center gap-2 px-4 py-8 text-center select-none">
              <Search class="size-8 text-text-muted/30" />
              <p class="text-xs font-medium text-text-secondary">
                No results for "<span class="text-text-primary">{query}</span>"
              </p>
            </div>
          {:else if results.length > 0}
            <ul
              bind:this={listEl}
              id="search-results"
              role="listbox"
              aria-label="Search results"
              class="scrollbar-none py-1.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {#if results.some(r => r.type === 'post')}
                <li class="px-4 pt-2.5 pb-1">
                  <span
                    class="text-xxs font-bold tracking-widest text-text-muted uppercase select-none"
                    >Blog posts</span>
                </li>
                {#each results.filter(r => r.type === 'post') as result, i (i)}
                  {@const globalIdx = results.indexOf(result)}
                  <li
                    id="result-{globalIdx}"
                    role="option"
                    tabindex="-1"
                    aria-selected={activeIndex === globalIdx}
                    data-result-item
                    onclick={() => select(result)}
                    onkeydown={e => handleResultKeydown(e, result)}
                    onmouseenter={() => (activeIndex = globalIdx)}
                    class="group mx-1.5 flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 transition-colors {(
                      activeIndex === globalIdx
                    ) ?
                      'bg-copilot/10'
                    : 'hover:bg-surface-hover'}">
                    <span
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-copilot/10 text-copilot">
                      <FileText class="size-4.5" />
                    </span>
                    <div class="min-w-0 flex-1">
                      <p
                        class="truncate text-sm font-semibold text-text-primary">
                        {@html highlight(result.title, query)}
                      </p>
                      {#if result.subtitle}
                        <p class="mt-0.5 truncate text-xs text-text-secondary">
                          {result.subtitle}
                        </p>
                      {/if}
                    </div>
                    <ArrowRight
                      class="size-4 shrink-0 text-text-muted/0 transition-colors select-none group-hover:text-copilot {(
                        activeIndex === globalIdx
                      ) ?
                        'text-text-muted'
                      : ''}" />
                  </li>
                {/each}
              {/if}

              {#if results.some(r => r.type === 'project')}
                <li class="mt-1 px-4 pt-2.5 pb-1">
                  <span
                    class="text-xxs font-bold tracking-widest text-text-muted uppercase select-none"
                    >GitHub projects</span>
                </li>
                {#each results.filter(r => r.type === 'project') as result, i (i)}
                  {@const globalIdx = results.indexOf(result)}
                  <li
                    id="result-{globalIdx}"
                    role="option"
                    tabindex="-1"
                    aria-selected={activeIndex === globalIdx}
                    data-result-item
                    onclick={() => select(result)}
                    onkeydown={e => handleResultKeydown(e, result)}
                    onmouseenter={() => (activeIndex = globalIdx)}
                    class="group mx-1.5 flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 transition-colors {(
                      activeIndex === globalIdx
                    ) ?
                      'bg-copilot/10'
                    : 'hover:bg-surface-hover'}">
                    <span
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-surface-hover text-text-secondary">
                      <svg
                        class="size-4.5 fill-current group-hover:text-copilot"
                        viewBox="0 0 24 24"
                        aria-hidden="true">
                        <path
                          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                    </span>
                    <div class="min-w-0 flex-1">
                      <p
                        class="truncate text-sm font-semibold text-text-primary">
                        {@html highlight(result.title, query)}
                      </p>
                      {#if result.tags && result.tags.length > 0}
                        <div class="mt-1 flex flex-wrap gap-1">
                          {#each result.tags as tag (tag)}
                            <span
                              class="rounded-sm bg-surface-hover px-1.5 py-0.5 font-sans text-2xs text-text-muted"
                              >{decodeHtmlEntities(tag)}</span>
                          {/each}
                        </div>
                      {:else if result.subtitle}
                        <p class="mt-0.5 truncate text-xs text-text-secondary">
                          {result.subtitle}
                        </p>
                      {/if}
                    </div>
                    <ExternalLink
                      class="size-4 shrink-0 text-text-muted/0 transition-colors group-hover:text-copilot {(
                        activeIndex === globalIdx
                      ) ?
                        'text-text-muted'
                      : ''}" />
                  </li>
                {/each}
              {/if}
            </ul>
          {/if}
        {/if}
      </div>

      <div
        class="flex flex-none items-center justify-end border-t border-border-subtle bg-surface-base/15 px-4 py-2.5 select-none">
        <div class="flex items-center gap-3.5 text-xs text-text-muted">
          <span class="flex items-center gap-1.5">
            <kbd
              class="inline-flex h-5.5 w-5.5 items-center justify-center rounded-sm border border-border-subtle bg-surface-base align-middle text-xxs font-semibold text-text-secondary">
              <ArrowUpDown class="size-3" />
            </kbd>
            navigate
          </span>
          <span class="flex items-center gap-1.5">
            <kbd
              class="inline-flex h-5.5 w-5.5 items-center justify-center rounded-sm border border-border-subtle bg-surface-base align-middle text-xxs font-semibold text-text-secondary">
              <CornerDownLeft class="size-3" />
            </kbd>
            open
          </span>
          <span class="flex items-center gap-1.5">
            <kbd
              class="inline-flex h-5.5 items-center justify-center rounded-sm border border-border-subtle bg-surface-base px-1.5 align-middle font-mono text-xxs font-semibold text-text-secondary">
              Esc
            </kbd>
            close
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .search-input,
  .search-input:focus,
  .search-input:active {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }

  .search-input::-webkit-search-cancel-button,
  .search-input::-webkit-search-decoration,
  .search-input::-webkit-search-results-button,
  .search-input::-webkit-search-results-decoration {
    -webkit-appearance: none;
    appearance: none;
    display: none;
  }
</style>
