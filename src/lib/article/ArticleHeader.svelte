<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';
  import {contentFontStore} from '../stores/contentFontStore.svelte';
  import {toastStore} from '../stores/toastStore.svelte';
  import {pushState} from '$app/navigation';

  interface Props {
    title: string;
    excerpt?: string;
    class?: string;
    titleClass?: string;
    titleViewTransitionName?: string;
    meta?: Snippet;
  }

  let {
    title,
    excerpt = '',
    class: className = '',
    titleClass = 'text-text-secondary',
    titleViewTransitionName = '',
    meta
  }: Props = $props();

  async function handleTitleClick(e: Event) {
    e.preventDefault();
    const url = `${window.location.origin}${window.location.pathname}#title`;
    try {
      await navigator.clipboard.writeText(url);
      toastStore.success('Link copied to clipboard');
    } catch (err) {
      void err;
    }
    const target = document.getElementById('title');
    if (target) {
      target.scrollIntoView({behavior: 'smooth', block: 'start'});
      pushState('#title', {});
    }
  }

  let titleParts = $derived.by(() => {
    const words = title.trim().split(/\s+/);
    if (words.length > 1) {
      return {
        hasMultiple: true,
        leading: words.slice(0, -1).join(' '),
        last: words[words.length - 1]
      };
    }
    return {hasMultiple: false, leading: '', last: title};
  });
</script>

<header
  class={cn('article-header border-b border-b-border-subtle pb-4', className)}>
  <h1
    id="title"
    style={titleViewTransitionName ?
      `view-transition-name: ${titleViewTransitionName}`
    : undefined}
    class={cn(
      'group cursor-pointer scroll-mt-20 font-sans-title',
      'text-lg leading-snug font-bold tracking-tight sm:text-3xl md:text-4xl',
      titleClass
    )}>
    {#if titleParts.hasMultiple}
      <span
        role="button"
        tabindex="0"
        onclick={handleTitleClick}
        onkeydown={e =>
          (e.key === 'Enter' || e.key === ' ') && handleTitleClick(e)}
        class="heading-text inline transition-none group-hover:text-accent group-hover:underline group-hover:underline-offset-4"
        >{titleParts.leading}&nbsp;<span class="whitespace-nowrap"
          >{titleParts.last}<a
            href="#title"
            aria-label="Copy link to heading"
            class="anchor-link ml-[0.35rem] inline-flex items-center justify-center align-middle leading-none whitespace-nowrap text-text-primary no-underline transition-none select-none dark:text-gh-gray-4"
            tabindex="-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-link-2 inline-block size-[0.75em] align-middle leading-none text-inherit no-underline opacity-0 select-none group-hover:text-accent group-hover:opacity-100 dark:group-hover:text-accent"
              aria-hidden="true"
              ><path d="M9 17H7A5 5 0 0 1 7 7h2" /><path
                d="M15 7h2a5 5 0 1 1 0 10h-2" /><line
                x1="8"
                x2="16"
                y1="12"
                y2="12" /></svg>
          </a></span
        ></span>
    {:else}
      <span
        role="button"
        tabindex="0"
        onclick={handleTitleClick}
        onkeydown={e =>
          (e.key === 'Enter' || e.key === ' ') && handleTitleClick(e)}
        class="heading-text inline whitespace-nowrap transition-none group-hover:text-accent group-hover:underline group-hover:underline-offset-4"
        >{titleParts.last}<a
          href="#title"
          aria-label="Copy link to heading"
          class="anchor-link ml-[0.35rem] inline-flex items-center justify-center align-middle leading-none whitespace-nowrap text-text-primary no-underline transition-none select-none dark:text-gh-gray-4"
          tabindex="-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-link-2 inline-block size-[0.75em] align-middle leading-none text-inherit no-underline opacity-0 select-none group-hover:text-accent group-hover:opacity-100 dark:group-hover:text-accent"
            aria-hidden="true"
            ><path d="M9 17H7A5 5 0 0 1 7 7h2" /><path
              d="M15 7h2a5 5 0 1 1 0 10h-2" /><line
              x1="8"
              x2="16"
              y1="12"
              y2="12" /></svg>
        </a></span>
    {/if}
  </h1>

  {#if excerpt}
    <p
      class={cn(
        'font-content-' + contentFontStore.current,
        'mt-2 text-base text-text-muted'
      )}>
      {excerpt}
    </p>
  {/if}

  {#if meta}
    <div class="mt-3">
      {@render meta()}
    </div>
  {/if}
</header>
