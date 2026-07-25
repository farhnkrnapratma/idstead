<!-- @format -->
<script lang="ts">
  import {onMount} from 'svelte'
  import {goto} from '$app/navigation'

  interface SearchResult {
    type: 'post' | 'project'
    title: string
    subtitle: string
    url: string
    tags?: string[]
  }

  interface Project {
    name: string
    desc: string
    tags: string[]
    url: string
    lang: string
    stars: number
    licenseName: string | null
    licenseUrl: string | null
  }

  interface Props {
    projects?: Project[]
  }

  let {projects = []}: Props = $props()

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
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      const postResults: SearchResult[] = data.results ?? []
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

  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  })

  function highlight(text: string, q: string): string {
    if (!q || q.length < 2) return text
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return text.replace(
      new RegExp(`(${escaped})`, 'gi'),
      '<mark class="bg-copilot/20 text-copilot rounded-[2px] px-[1px] not-italic font-semibold">$1</mark>'
    )
  }
</script>

<button
  type="button"
  onclick={open}
  class="group flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
  aria-label="Open spotlight search (Ctrl+K)"
  title="Search (Ctrl+K)"
>
  <i class="bi bi-search text-sm" aria-hidden="true"></i>
  <span class="hidden sm:inline">Search</span>
  <kbd
    class="bg-surface-canvas ml-1.5 hidden h-5 items-center justify-center rounded border border-border-subtle px-1.5 align-middle font-mono text-[11px] leading-none font-semibold text-text-secondary sm:inline-flex"
  >
    Ctrl+K
  </kbd>
</button>

{#if isOpen}
  <div
    class="fixed inset-0 z-9999 flex items-start justify-center px-4 pt-[15vh]"
  >
    <button
      type="button"
      class="absolute inset-0 cursor-default bg-overlay-backdrop backdrop-blur-sm transition-all duration-300"
      aria-label="Close search"
      onclick={close}
    ></button>

    <div
      class="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-border-subtle bg-surface-card shadow-2xl"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Spotlight Search"
      onkeydown={handleKeydown}
    >
      <div class="border-b border-border-subtle px-4 py-1.5">
        <div
          class="bg-surface-canvas/40 flex items-center gap-3 rounded-xl border border-border-subtle px-3 py-0.5 transition-all duration-150 focus-within:border-copilot/60 focus-within:ring-1 focus-within:ring-copilot/20"
        >
          {#if isLoading}
            <svg
              class="h-4 w-4 shrink-0 animate-spin text-copilot"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                class="stroke-copilot stroke-3 opacity-25"
                cx="12"
                cy="12"
                r="10"
              >
              </circle>
              <path
                class="fill-copilot stroke-copilot opacity-25"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              ></path>
            </svg>
          {:else}
            <i
              class="bi bi-search shrink-0 text-sm text-text-secondary"
              aria-hidden="true"
            ></i>
          {/if}

          <input
            bind:this={inputEl}
            bind:value={query}
            oninput={handleInput}
            type="search"
            spellcheck="false"
            autocomplete="off"
            placeholder="Search posts & projects…"
            class="search-input w-full bg-transparent text-base font-semibold text-text-primary placeholder:font-medium placeholder:text-text-muted focus:outline-none"
            aria-label="Search query"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-activedescendant={activeIndex >= 0 ?
              `result-${activeIndex}`
            : undefined}
          />

          <button
            type="button"
            onclick={close}
            class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none"
            aria-label="Close search"
          >
            <span>Cancel</span>
            <kbd
              class="hidden items-center rounded border border-border-subtle bg-surface-card px-1.5 py-0.5 font-mono text-[9px] leading-none text-text-muted select-none sm:inline-flex"
            >
              Esc
            </kbd>
          </button>
        </div>
      </div>

      {#if query.length < 2}
        <div
          class="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center select-none"
        >
          <i class="bi bi-search text-3xl text-text-muted/30" aria-hidden="true"
          ></i>
          <p class="text-xs text-text-muted">
            Start typing to search posts & projects
          </p>
        </div>
      {:else}
        {#if results.length === 0 && !isLoading}
          <div
            class="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center select-none"
          >
            <i
              class="bi bi-search text-3xl text-text-muted/30"
              aria-hidden="true"
            ></i>
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
            class="no-scrollbar max-h-80 overflow-y-auto py-1.5"
          >
            {#if results.some(r => r.type === 'post')}
              <li class="px-4 pt-2.5 pb-1">
                <span
                  class="text-[11px] font-bold tracking-widest text-text-muted uppercase select-none"
                  >Blog posts</span
                >
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
                  class="group mx-1.5 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors {(
                    activeIndex === globalIdx
                  ) ?
                    'bg-copilot/10'
                  : 'hover:bg-surface-hover'}"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-copilot/10 text-copilot"
                  >
                    <i
                      class="bi bi-file-earmark-text text-base"
                      aria-hidden="true"
                    ></i>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-text-primary">
                      {@html highlight(result.title, query)}
                    </p>
                    {#if result.subtitle}
                      <p class="mt-0.5 truncate text-xs text-text-secondary">
                        {result.subtitle}
                      </p>
                    {/if}
                  </div>
                  <span
                    class="material-symbols-rounded shrink-0 leading-none text-text-muted/0 transition-colors select-none group-hover:text-copilot {(
                      activeIndex === globalIdx
                    ) ?
                      'text-text-muted'
                    : ''}"
                    style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                    aria-hidden="true">arrow_forward</span
                  >
                </li>
              {/each}
            {/if}

            {#if results.some(r => r.type === 'project')}
              <li class="mt-1 px-4 pt-2.5 pb-1">
                <span
                  class="text-[11px] font-bold tracking-widest text-text-muted uppercase select-none"
                  >GitHub projects</span
                >
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
                  class="group mx-1.5 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors {(
                    activeIndex === globalIdx
                  ) ?
                    'bg-copilot/10'
                  : 'hover:bg-surface-hover'}"
                >
                  <span
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-text-secondary"
                  >
                    <i
                      class="bi bi-github text-base group-hover:text-copilot"
                      aria-hidden="true"
                    ></i>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-text-primary">
                      {@html highlight(result.title, query)}
                    </p>
                    {#if result.tags && result.tags.length > 0}
                      <div class="mt-1 flex flex-wrap gap-1">
                        {#each result.tags as tag (tag)}
                          <span
                            class="rounded-md bg-surface-hover px-1.5 py-0.5 font-sans text-[10px] text-text-muted"
                            >{tag}</span
                          >
                        {/each}
                      </div>
                    {:else if result.subtitle}
                      <p class="mt-0.5 truncate text-xs text-text-secondary">
                        {result.subtitle}
                      </p>
                    {/if}
                  </div>
                  <i
                    class="material-symbols-rounded shrink-0 leading-none text-text-muted/0 transition-colors group-hover:text-copilot {(
                      activeIndex === globalIdx
                    ) ?
                      'text-text-muted'
                    : ''}"
                    style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
                    aria-hidden="true">open_in_new</i
                  >
                </li>
              {/each}
            {/if}
          </ul>
        {/if}
      {/if}

      <div
        class="bg-surface-canvas/15 flex items-center justify-end border-t border-border-subtle px-4 py-2.5 select-none"
      >
        <div class="flex items-center gap-3.5 text-xs text-text-muted">
          <span class="flex items-center gap-1.5">
            <kbd
              class="bg-surface-canvas inline-flex h-5.5 w-5.5 items-center justify-center rounded border border-border-subtle align-middle text-[11px] font-semibold text-text-secondary"
            >
              <i class="bi bi-arrow-down-up text-[11px]" aria-hidden="true"></i>
            </kbd>
            navigate
          </span>
          <span class="flex items-center gap-1.5">
            <kbd
              class="bg-surface-canvas inline-flex h-5.5 w-5.5 items-center justify-center rounded border border-border-subtle align-middle text-[11px] font-semibold text-text-secondary"
            >
              <i class="bi bi-arrow-return-left text-[11px]" aria-hidden="true"
              ></i>
            </kbd>
            open
          </span>
          <span class="flex items-center gap-1.5">
            <kbd
              class="bg-surface-canvas inline-flex h-5.5 items-center justify-center rounded border border-border-subtle px-1.5 align-middle font-mono text-[11px] font-semibold text-text-secondary uppercase"
            >
              esc
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
