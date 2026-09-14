<script lang="ts">
  import {shortcut} from '../utils/shortcut.svelte';
  import {buttonKey} from '$lib/shortcuts';
  import {onDestroy} from 'svelte';
  import {
    Sparkles,
    ListCollapse,
    ChevronsUpDown,
    ChevronsDownUp
  } from '@lucide/svelte';
  import {cn} from '../utils/cn';
  import {contentFontStore} from '../stores/contentFontStore.svelte';

  interface Props {
    mode?: 'all' | 'tldr-only' | 'summary-only';
    tldr?: string[] | null;
    summary?: string | null;
    class?: string;
  }

  let {
    mode = 'all',
    tldr = null,
    summary = null,
    class: className = ''
  }: Props = $props();

  const REVEAL_DURATION_MS = 2800;
  const DOTS_DWELL_MS = 1100;

  let detailsElement = $state<HTMLDetailsElement | null>(null);
  let isTldrOpen = $state(true);
  let hasStartedReveal = false;
  let loadingDots = $state(false);
  let typing = $state(false);
  let displayedSummary = $state('');
  let frame: number | null = null;
  let dotsTimeout: ReturnType<typeof setTimeout> | null = null;

  function cleanupAnimation() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    if (dotsTimeout !== null) {
      clearTimeout(dotsTimeout);
      dotsTimeout = null;
    }
    loadingDots = false;
    typing = false;
  }

  $effect(() => {
    if (tldr && tldr.length > 0) {
      isTldrOpen = true;
    }
  });

  $effect(() => {
    const text = summary;
    cleanupAnimation();
    if (detailsElement?.open && text) {
      hasStartedReveal = true;
      displayedSummary = text;
    } else {
      hasStartedReveal = false;
      displayedSummary = '';
    }
  });

  function startTyping(text: string) {
    typing = true;
    displayedSummary = '';
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / REVEAL_DURATION_MS);
      const eased = -(Math.cos(Math.PI * progress) - 1) / 2;
      const charsToShow = Math.ceil(text.length * eased);
      displayedSummary = text.slice(0, charsToShow);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        displayedSummary = text;
        typing = false;
        frame = null;
      }
    };
    frame = requestAnimationFrame(step);
  }

  function handleSummaryToggle(event: Event) {
    const target = event.currentTarget as HTMLDetailsElement;
    if (!target.open || hasStartedReveal || !summary) return;
    hasStartedReveal = true;
    loadingDots = true;
    const text = summary;
    dotsTimeout = setTimeout(() => {
      loadingDots = false;
      startTyping(text);
    }, DOTS_DWELL_MS);
  }

  onDestroy(() => {
    cleanupAnimation();
  });
</script>

{#snippet tldrCard(customClass = '')}
  {#if tldr && tldr.length > 0}
    <details
      bind:open={isTldrOpen}
      class={cn(
        'group markdown-details my-0 shrink-0 overflow-hidden rounded-md glass-card border border-border-subtle text-text-primary shadow-md backdrop-blur-md',
        customClass
      )}>
      <summary
        use:shortcut={{
          combo: buttonKey('tldr'),
          label: 'TL;DR',
          placement: 'trailing'
        }}
        class="markdown-details-summary relative flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 border-b border-transparent px-3.5 py-1.5 text-sm font-medium text-text-primary transition-colors select-none group-open:border-border-subtle hover:bg-surface-hover/50 dark:group-open:border-white/10 [&::-webkit-details-marker]:hidden">
        <span class="inline-flex items-center gap-2">
          <ListCollapse class="size-4 shrink-0 text-text-primary" />
          <span
            class="translate-y-px text-sm leading-none font-medium text-text-primary"
            >TL;DR</span>
        </span>
        <span
          class="markdown-details-icon inline-flex shrink-0 items-center justify-center text-text-muted"
          aria-hidden="true">
          <ChevronsUpDown class="size-3.5 group-open:hidden" />
          <ChevronsDownUp class="hidden size-3.5 group-open:block" />
        </span>
      </summary>
      <div
        class="markdown-details-body font-content-{contentFontStore.current} px-3.5 py-3 text-sm leading-relaxed text-text-secondary">
        <ul class="flex list-none flex-col gap-1 pl-0">
          {#each tldr as point (point)}
            <li class="flex items-start gap-1.5 leading-normal">
              <span
                class="ul-dot flex h-5 w-2.5 shrink-0 items-center justify-center"
                aria-hidden="true">
                <span class="size-1.5 rounded-full bg-text-secondary"></span>
              </span>
              <span class="min-w-0 flex-1 leading-normal">{point}</span>
            </li>
          {/each}
        </ul>
      </div>
    </details>
  {/if}
{/snippet}

{#snippet summaryCard(customClass = '')}
  {#if summary}
    <details
      bind:this={detailsElement}
      class={cn(
        'group markdown-details my-0 shrink-0 overflow-hidden rounded-md glass-card border border-border-subtle text-text-primary shadow-md backdrop-blur-md',
        customClass
      )}
      ontoggle={handleSummaryToggle}>
      <summary
        use:shortcut={{
          combo: buttonKey('summary'),
          label: 'Summarize this article',
          placement: 'trailing'
        }}
        class="markdown-details-summary relative flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 border-b border-transparent px-3.5 py-1.5 text-sm font-medium text-text-primary transition-colors select-none group-open:border-border-subtle hover:bg-surface-hover/50 dark:group-open:border-white/10 [&::-webkit-details-marker]:hidden">
        <span class="inline-flex items-center gap-2">
          <Sparkles class="size-4 shrink-0 text-text-primary" />
          <span
            class="translate-y-px text-sm leading-none font-medium text-text-primary"
            >Summarize this article</span>
        </span>
        <span
          class="markdown-details-icon inline-flex shrink-0 items-center justify-center text-text-muted"
          aria-hidden="true">
          <ChevronsUpDown class="size-3.5 group-open:hidden" />
          <ChevronsDownUp class="hidden size-3.5 group-open:block" />
        </span>
      </summary>
      <div
        class="markdown-details-body font-content-{contentFontStore.current} px-3.5 py-3 text-sm leading-relaxed text-text-secondary">
        {#if loadingDots}
          <div
            class="flex items-center gap-1.5 py-1.5"
            aria-hidden="true">
            <span
              class="size-1.5 animate-pulse rounded-full bg-text-muted [animation-duration:1s]"
            ></span>
            <span
              class="size-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:200ms] [animation-duration:1s]"
            ></span>
            <span
              class="size-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:400ms] [animation-duration:1s]"
            ></span>
          </div>
        {:else}
          <p
            class="font-content-{contentFontStore.current} text-sm leading-relaxed text-text-secondary">
            {displayedSummary}{#if typing}<span class="animate-pulse">▍</span
              >{/if}
          </p>
        {/if}
      </div>
    </details>
  {/if}
{/snippet}

{#if mode === 'tldr-only'}
  {@render tldrCard(className)}
{:else if mode === 'summary-only'}
  {@render summaryCard(className)}
{:else if (tldr && tldr.length > 0) || summary}
  <div class={cn('flex shrink-0 flex-col gap-3', className)}>
    {@render tldrCard()}
    {@render summaryCard()}
  </div>
{/if}
