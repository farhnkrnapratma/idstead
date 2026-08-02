<!-- @format -->
<script lang="ts">
  import {pushState} from '$app/navigation'
  import {onMount} from 'svelte'

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
      headingObserver?.disconnect()
      if (scrollTimeout) clearTimeout(scrollTimeout)
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
        '<code class="font-mono text-inherit px-1 py-0.5 rounded bg-adwaita-hover font-normal">$1</code>'
      )
      .replace(
        /\[([^\]]+)\]/g,
        '<code class="font-mono text-inherit px-1 py-0.5 rounded bg-adwaita-hover font-normal">[$1]</code>'
      )
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  }
</script>

{#if headings.length > 0}
  <nav
    aria-label="Table of contents"
    class="rounded-md border border-border-subtle bg-surface-card/45 p-4 shadow-xs backdrop-blur-lg select-none {className}">
    <h3
      class="mb-3 text-xs font-bold tracking-wider text-text-secondary uppercase select-none">
      In this article
    </h3>

    <div class="relative pl-3">
      <div
        class="absolute top-0 bottom-0 left-0 w-1 rounded-full bg-border-subtle/40"
        aria-hidden="true">
      </div>

      {#if isIndicatorVisible}
        <div
          class="absolute left-0 w-1 rounded-full bg-copilot shadow-xs"
          style="top: {indicatorTop}px; height: {indicatorHeight}px; transition: {(
            isStretching
          ) ?
            'top 0.12s ease-out, height 0.12s ease-out'
          : 'top 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'};"
          aria-hidden="true">
        </div>
      {/if}

      <ul
        bind:this={tocListEl}
        class="relative flex flex-col gap-1"
        role="list">
        {#each headings as heading, index (heading.id + '-' + index)}
          {@const isActive = activeHeadingId === heading.id}
          <li
            class="text-xs"
            style="padding-left: {(heading.level - 2) * 10}px;">
            <a
              href="#{heading.id}"
              onclick={e => {
                e.preventDefault()
                const target = document.getElementById(heading.id)
                if (target) {
                  target.scrollIntoView({behavior: 'smooth', block: 'start'})
                  pushState(`#${heading.id}`, {})
                  activeHeadingId = heading.id
                  updateIndicatorPos(heading.id, false)
                }
              }}
              aria-current={isActive ? 'true' : undefined}
              class="group relative block rounded-md py-1 pr-2 leading-relaxed transition-colors duration-300 ease-in-out hover:text-copilot {(
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
