<script lang="ts">
  import {ThumbsUp, ThumbsDown, CheckCircle2} from '@lucide/svelte';
  import {cn} from '../utils/cn';

  interface Props {
    title?: string;
    subtitle?: string;
    voted?: boolean | null;
    variant?: 'compact' | 'responsive';
    onVote?: (helpful: boolean) => void;
    onFeedbackClick?: () => void;
    class?: string;
  }

  let {
    title = 'Help improve this article',
    subtitle = 'Was this article helpful to you?',
    voted = null,
    variant = 'responsive',
    onVote,
    onFeedbackClick,
    class: className = ''
  }: Props = $props();

  let localVoted = $state<boolean | null>(null);

  let currentVoted = $derived(voted !== null ? voted : localVoted);

  function handleVote(helpful: boolean) {
    localVoted = helpful;
    onVote?.(helpful);
  }
</script>

{#if variant === 'compact'}
  <div
    class={cn(
      'flex shrink-0 flex-col gap-2.5 rounded-md glass-card p-3.5 text-left select-none sm:p-4',
      className
    )}>
    <div class="flex flex-col gap-1">
      <h3
        class="font-sans-title text-xs font-bold tracking-tight text-text-primary sm:text-sm">
        {title}
      </h3>
      {#if currentVoted === null}
        <p class="font-sans-title text-xs leading-normal text-text-secondary">
          {subtitle}
        </p>
      {/if}
    </div>

    {#if currentVoted !== null}
      <div
        class="flex items-center gap-1.5 font-sans-title text-xs font-semibold text-accent">
        <CheckCircle2 class="size-3.5 shrink-0" />
        <span>Thanks for your feedback!</span>
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          class="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 font-sans-title text-xs font-semibold text-emerald-600 transition-all hover:border-emerald-500/60 hover:bg-emerald-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:scale-95 dark:text-emerald-400"
          onclick={() => handleVote(true)}
          aria-label="Yes, this was helpful">
          <ThumbsUp
            class="size-3.5 select-none"
            strokeWidth={1.75}
            absoluteStrokeWidth={true} />
          <span>Yes</span>
        </button>
        <button
          type="button"
          class="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/5 px-2 py-1.5 font-sans-title text-xs font-semibold text-rose-600 transition-all hover:border-rose-500/60 hover:bg-rose-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 active:scale-95 dark:text-rose-400"
          onclick={() => handleVote(false)}
          aria-label="No, this was not helpful">
          <ThumbsDown
            class="size-3.5 select-none"
            strokeWidth={1.75}
            absoluteStrokeWidth={true} />
          <span>No</span>
        </button>
      </div>

      {#if onFeedbackClick}
        <button
          type="button"
          class="w-fit cursor-pointer text-left font-sans-title text-xs font-medium text-accent hover:underline focus-visible:outline-none"
          onclick={onFeedbackClick}>
          Share your feedback
        </button>
      {/if}
    {/if}
  </div>
{:else}
  <div
    class={cn(
      'relative overflow-hidden rounded-md glass-card p-5 select-none sm:p-6',
      className
    )}>
    <div
      class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div
        class="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
        <div class="flex flex-col gap-1">
          <h3
            class="font-sans-title text-base font-bold tracking-tight text-text-primary sm:text-lg">
            {title}
          </h3>
          {#if currentVoted === null}
            <p class="font-sans text-xs text-text-secondary sm:text-sm">
              {subtitle}
            </p>
          {/if}
        </div>

        {#if currentVoted !== null}
          <div
            class="flex items-center justify-center gap-2 font-sans-title text-sm font-semibold text-accent sm:justify-start">
            <CheckCircle2 class="size-4 shrink-0" />
            <span>Thanks for your feedback!</span>
          </div>
        {:else}
          <div
            class="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
            <button
              type="button"
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-1.5 font-sans-title text-xs font-semibold text-emerald-600 transition-all hover:border-emerald-500/60 hover:bg-emerald-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:scale-95 dark:text-emerald-400"
              onclick={() => handleVote(true)}
              aria-label="Yes, this was helpful">
              <ThumbsUp
                class="size-3.5 select-none"
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
              <span>Yes</span>
            </button>
            <button
              type="button"
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/5 px-3.5 py-1.5 font-sans-title text-xs font-semibold text-rose-600 transition-all hover:border-rose-500/60 hover:bg-rose-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 active:scale-95 dark:text-rose-400"
              onclick={() => handleVote(false)}
              aria-label="No, this was not helpful">
              <ThumbsDown
                class="size-3.5 select-none"
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
              <span>No</span>
            </button>
          </div>

          {#if onFeedbackClick}
            <button
              type="button"
              class="w-fit cursor-pointer text-center text-xs font-medium text-accent hover:underline focus-visible:outline-none sm:text-left"
              onclick={onFeedbackClick}>
              Share your feedback
            </button>
          {/if}
        {/if}
      </div>

      <div
        class="relative hidden size-20 shrink-0 items-center justify-center sm:flex"
        aria-hidden="true">
        <div
          class="absolute inset-0 rounded-full border border-dashed border-border-subtle/80 bg-surface-elevated/40">
        </div>
        <svg
          class="relative size-14 text-accent"
          viewBox="0 0 56 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <rect
            x="4"
            y="6"
            width="28"
            height="22"
            rx="5"
            class="fill-accent/20 stroke-accent"
            stroke-width="1.5" />
          <path
            d="M8 28L5 33L13 28H8Z"
            class="fill-accent/20 stroke-accent"
            stroke-width="1.5" />
          <text
            x="18"
            y="21"
            text-anchor="middle"
            class="fill-accent font-serif text-[14px] font-bold">
            &ldquo;
          </text>
          <rect
            x="24"
            y="24"
            width="26"
            height="20"
            rx="5"
            class="fill-surface-elevated stroke-border-subtle"
            stroke-width="1.5" />
          <path
            d="M44 44L47 49L39 44H44Z"
            class="fill-surface-elevated stroke-border-subtle"
            stroke-width="1.5" />
          <text
            x="37"
            y="38"
            text-anchor="middle"
            class="fill-text-secondary font-serif text-[13px] font-bold">
            &rdquo;
          </text>
        </svg>
      </div>
    </div>
  </div>
{/if}
