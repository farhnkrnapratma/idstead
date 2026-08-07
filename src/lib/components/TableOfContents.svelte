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
    class?: string
  }

  let {headings = [], class: className = ''}: Props = $props()

  let activeHeadingId = $state('')
  let indicatorTop = $state(0)
  let indicatorHeight = $state(0)
  let isIndicatorVisible = $state(false)
  let isStretching = $state(false)
  let tocListEl = $state<HTMLUListElement | null>(null)
  let railEl = $state<HTMLDivElement | null>(null)
  let isDraggingRail = $state(false)

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
    updateIndicatorPos(id, false)
  }

  function scrollToNearestHeading(clientY: number, instant = false) {
    if (!tocListEl || headings.length === 0) return
    const links = headings
      .map(h => {
        const link = tocListEl?.querySelector(
          `[href="#${h.id}"]`
        ) as HTMLElement | null
        if (!link) return null
        const rect = link.getBoundingClientRect()
        return {id: h.id, center: rect.top + rect.height / 2}
      })
      .filter((l): l is {id: string; center: number} => l !== null)

    if (links.length === 0) return

    let nearest = links[0]
    let nearestDist = Math.abs(clientY - nearest.center)
    for (const link of links) {
      const dist = Math.abs(clientY - link.center)
      if (dist < nearestDist) {
        nearest = link
        nearestDist = dist
      }
    }
    navigateToHeading(nearest.id, instant)
  }

  function handleRailPointerDown(e: MouseEvent) {
    isDraggingRail = true
    scrollToNearestHeading(e.clientY, true)
  }

  function updateIndicatorPos(
    id: string,
    stretching = false,
    forcedTop?: number,
    forcedHeight?: number
  ) {
    isStretching = stretching
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
    let scrollTimeout: ReturnType<typeof setTimeout>
    let rafId: number | null = null
    let lastScrollY = window.scrollY

    const elements = headings
      .map(h => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null)

    const updateScrollspyPosition = () => {
      if (isPinnedByClick) return
      if (!tocListEl || headings.length === 0) return
      const scrollY = window.scrollY
      const isScrollingDown = scrollY > lastScrollY
      lastScrollY = scrollY

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
      const hNext = headingPositions[currentIndex + 1]
      const lCurrent = tocLinks.find(l => l.id === hCurrent.id)
      const lNext = hNext ? tocLinks.find(l => l.id === hNext.id) : null

      if (!lCurrent) return

      if (!hNext || !lNext) {
        activeHeadingId = hCurrent.id
        updateIndicatorPos(hCurrent.id, false, lCurrent.top, lCurrent.height)
        return
      }

      const segDistance = hNext.top - hCurrent.top
      if (segDistance <= 0) {
        activeHeadingId = hCurrent.id
        updateIndicatorPos(hCurrent.id, false, lCurrent.top, lCurrent.height)
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

    let dragRafId: number | null = null
    let pendingDragY: number | null = null

    const handleRailDrag = (e: MouseEvent) => {
      if (!isDraggingRail) return
      pendingDragY = e.clientY
      if (dragRafId !== null) return
      dragRafId = requestAnimationFrame(() => {
        dragRafId = null
        if (pendingDragY !== null) scrollToNearestHeading(pendingDragY, true)
      })
    }
    const handleRailDragEnd = () => {
      isDraggingRail = false
      if (dragRafId !== null) {
        cancelAnimationFrame(dragRafId)
        dragRafId = null
      }
    }
    window.addEventListener('mousemove', handleRailDrag)
    window.addEventListener('mouseup', handleRailDragEnd)

    headingObserver = new IntersectionObserver(
      entries => {
        if (isPinnedByClick) return
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
      window.removeEventListener('mousemove', handleRailDrag)
      window.removeEventListener('mouseup', handleRailDragEnd)
      headingObserver?.disconnect()
      if (scrollTimeout) clearTimeout(scrollTimeout)
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (dragRafId !== null) cancelAnimationFrame(dragRafId)
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
      'flex flex-col rounded-sm border border-border-subtle bg-surface-card/30 p-4 shadow-xs backdrop-blur-xl select-none',
      className
    )}>
    <h3
      class="mb-3 shrink-0 text-xs font-bold tracking-wider text-text-secondary uppercase select-none">
      In this article
    </h3>

    <div class="relative min-h-0 overflow-y-auto pl-3">
      <div
        bind:this={railEl}
        onmousedown={handleRailPointerDown}
        role="scrollbar"
        aria-controls="toc-list"
        aria-orientation="vertical"
        aria-valuenow={0}
        tabindex="-1"
        class="absolute top-0 bottom-0 left-0 w-1.5 cursor-pointer rounded-sm bg-border-subtle/40">
      </div>

      {#if isIndicatorVisible}
        <div
          onmousedown={handleRailPointerDown}
          class="absolute top-[var(--indicator-top)] left-0 h-[var(--indicator-height)] w-1.5 rounded-sm bg-copilot shadow-xs transition-[top,height] {(
            isStretching || isDraggingRail
          ) ?
            'duration-[120ms] ease-out'
          : 'duration-[600ms] ease-in-out'} {isDraggingRail ? 'cursor-grabbing'
          : 'cursor-grab'}"
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
          {@const hasTopGap = index !== 0 && heading.level <= 2}
          <li
            class="pl-[var(--toc-indent)] text-xs {hasTopGap ? 'mt-1' : ''}"
            style="--toc-indent: {(heading.level - 2) * 16}px;">
            <a
              href="#{heading.id}"
              onclick={e => {
                e.preventDefault()
                navigateToHeading(heading.id)
              }}
              aria-current={isActive ? 'true' : undefined}
              class="group relative block rounded-sm py-0.5 pr-2 leading-snug transition-colors duration-300 ease-in-out hover:text-copilot {(
                isActive
              ) ?
                'font-semibold text-copilot'
              : 'font-normal text-text-secondary'}">
              <span>{@html formatHeadingText(heading.text)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </nav>
{/if}
