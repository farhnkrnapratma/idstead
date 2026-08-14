<!-- @format -->
<script lang="ts">
  import {pushState} from '$app/navigation'
  import {onMount} from 'svelte'
  import {cn} from '../utils/cn'

  interface HeadingItem {
    id: string
    text: string
    level: number
  }

  interface Props {
    headings: HeadingItem[]
    collapsible?: boolean
    defaultCollapsed?: boolean
    class?: string
  }

  let {
    headings = [],
    collapsible = false,
    defaultCollapsed = false,
    class: className = ''
  }: Props = $props()

  let activeHeadingId = $state('')
  let indicatorTop = $state(0)
  let indicatorHeight = $state(0)
  let isIndicatorVisible = $state(false)
  let tocListEl = $state<HTMLUListElement | null>(null)

  // While true, the scrollspy is told to trust the manually-set active
  // heading instead of clearing it — otherwise a heading close to the top
  // of the page (most commonly the first one) can read as "not yet reached"
  // for a transient scrollY sample mid-navigation, hiding the indicator
  // until the next unrelated scroll happens to fix it.
  let isPinnedByClick = false
  let unpinTimeout: ReturnType<typeof setTimeout> | undefined

  function unpinAfterSettle() {
    if (unpinTimeout) clearTimeout(unpinTimeout)
    window.removeEventListener('scrollend', unpinAfterSettle)
    isPinnedByClick = false
  }

  function pinActiveHeading() {
    isPinnedByClick = true
    if (unpinTimeout) clearTimeout(unpinTimeout)
    window.addEventListener('scrollend', unpinAfterSettle, {once: true})
    unpinTimeout = setTimeout(unpinAfterSettle, 1500)
  }

  function navigateToHeading(id: string, instant = false) {
    const target = document.getElementById(id)
    if (!target) return
    pinActiveHeading()
    target.scrollIntoView({
      behavior: instant ? 'auto' : 'smooth',
      block: 'start'
    })
    pushState(`#${id}`, {})
    activeHeadingId = id
    updateIndicatorPos(id)
  }

  function updateIndicatorPos(
    id: string,
    forcedTop?: number,
    forcedHeight?: number
  ) {
    if (!tocListEl) return
    const activeEl = tocListEl.querySelector(`[href="#${id}"]`) as HTMLElement
    if (activeEl) {
      const top = forcedTop !== undefined ? forcedTop : activeEl.offsetTop
      const height =
        forcedHeight !== undefined ? forcedHeight : activeEl.offsetHeight
      indicatorTop = top
      indicatorHeight = height
      isIndicatorVisible = true
    }
  }

  onMount(() => {
    if (headings.length === 0) return

    let headingObserver: IntersectionObserver | null = null
    let rafId: number | null = null

    const elements = headings
      .map(h => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null)

    const updateScrollspyPosition = () => {
      if (isPinnedByClick) return
      if (!tocListEl || headings.length === 0) return
      const scrollY = window.scrollY

      const tocLinks = headings
        .map(h => {
          const link = tocListEl?.querySelector(
            `[href="#${h.id}"]`
          ) as HTMLElement
          return link ?
              {id: h.id, top: link.offsetTop, height: link.offsetHeight}
            : null
        })
        .filter(
          (l): l is {id: string; top: number; height: number} => l !== null
        )

      if (tocLinks.length === 0) return

      const viewportOffset = 160
      const headingPositions = headings
        .map(h => {
          const el = document.getElementById(h.id)
          return el ?
              {id: h.id, top: el.getBoundingClientRect().top + scrollY}
            : null
        })
        .filter((h): h is {id: string; top: number} => h !== null)

      if (headingPositions.length === 0) return

      let currentIndex = -1
      for (let i = 0; i < headingPositions.length; i++) {
        if (scrollY >= headingPositions[i].top - viewportOffset) {
          currentIndex = i
        } else {
          break
        }
      }

      if (currentIndex === -1) {
        activeHeadingId = ''
        isIndicatorVisible = false
        return
      }

      const hCurrent = headingPositions[currentIndex]
      const lCurrent = tocLinks.find(l => l.id === hCurrent.id)

      if (!lCurrent) return

      activeHeadingId = hCurrent.id
      updateIndicatorPos(hCurrent.id, lCurrent.top, lCurrent.height)
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
        if (isPinnedByClick) return
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            activeHeadingId = entry.target.id
            updateIndicatorPos(entry.target.id)
          }
        })
      },
      {root: null, rootMargin: '0px 0px -70% 0px', threshold: 0.1}
    )

    elements.forEach(el => headingObserver?.observe(el))

    return () => {
      window.removeEventListener('scroll', handleScroll)
      headingObserver?.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  })
  function formatHeadingText(text: string): string {
    if (!text) return ''
    if (/<[a-z][\s\S]*>/i.test(text)) {
      return text
    }
    return text
      .replace(
        /`([^`]+)`/g,
        '<code class="font-mono text-inherit px-1 py-0.5 rounded-sm bg-adwaita-hover font-normal">$1</code>'
      )
      .replace(
        /\[([^\]]+)\]/g,
        '<code class="font-mono text-inherit px-1 py-0.5 rounded-sm bg-adwaita-hover font-normal">[$1]</code>'
      )
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  }
</script>

{#if headings.length > 0}
  <nav
    aria-label="Table of contents"
    class={cn(
      'flex flex-col rounded-sm glass-card p-4 select-none',
      className
    )}>
    <h3
      class="mb-3 shrink-0 text-xs font-bold tracking-wider text-text-secondary uppercase select-none">
      In this article
    </h3>

    <div class="relative min-h-0 overflow-y-auto pl-3">
      <div
        class="pointer-events-none absolute top-0 bottom-0 left-0 w-0.5 bg-border-subtle/40">
      </div>

      {#if isIndicatorVisible}
        <div
          class="pointer-events-none absolute top-(--indicator-top) left-0 h-(--indicator-height) w-0.5 bg-copilot shadow-xs"
          style="--indicator-top: {indicatorTop}px; --indicator-height: {indicatorHeight}px;"
          aria-hidden="true">
        </div>
      {/if}

      <ul
        id="toc-list"
        bind:this={tocListEl}
        class="relative flex flex-col"
        role="list">
        {#each headings as heading, index (heading.id + '-' + index)}
          {@const isActive = activeHeadingId === heading.id}
          {@const isSub = heading.level > 2}
          {@const hasTopGap = index !== 0 && heading.level <= 2}
          <li class="text-xs {hasTopGap ? 'mt-1' : ''}">
            <a
              href="#{heading.id}"
              onclick={e => {
                e.preventDefault()
                navigateToHeading(heading.id)
              }}
              aria-current={isActive ? 'true' : undefined}
              class="-ml-3 flex items-start rounded-r-xs py-0.5 pr-2 leading-snug transition-colors duration-150 ease-in-out hover:text-copilot {(
                isActive
              ) ?
                'bg-copilot/10 font-semibold text-copilot'
              : 'font-normal text-text-secondary hover:bg-surface-hover/30'}"
              style="padding-left: {isSub ?
                `${6 + (heading.level - 3) * 10}px`
              : '0.75rem'};">
              {#if isSub}
                <span
                  class="mt-[0.55em] mr-1.5 inline-block h-0.5 w-3 shrink-0 rounded-full select-none {(
                    isActive
                  ) ?
                    'bg-copilot/60'
                  : 'bg-border-subtle/80'}"
                  aria-hidden="true"></span>
              {/if}
              <span class="min-w-0 grow"
                >{@html formatHeadingText(heading.text)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </nav>
{/if}
