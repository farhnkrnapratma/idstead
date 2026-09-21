<script lang="ts">
  import {shortcut} from '../utils/shortcut.svelte';
  import {buttonKey, COMMAND_SHORTCUTS} from '$lib/shortcuts';
  import {shortcutStore} from '../stores/shortcutStore.svelte';
  import {onMount} from 'svelte';
  import {
    ThumbsUp,
    ThumbsDown,
    CheckCircle2,
    Share2,
    Send,
    MessageSquareQuote,
    AtSign
  } from '@lucide/svelte';
  import FieldMessage from '../components/FieldMessage.svelte';
  import {cn} from '../utils/cn';

  interface Props {
    title?: string;
    subtitle?: string;
    voted?: boolean | null;
    pending?: boolean;
    error?: string;
    shareLabel?: string;
    onVote?: (helpful: boolean) => void;
    onFeedbackClick?: () => void;
    class?: string;
  }

  let {
    title = 'Help improve this article',
    subtitle = 'Was this article helpful to you?',
    voted = null,
    pending = false,
    error = '',
    shareLabel = 'Share this article',
    onVote,
    onFeedbackClick,
    class: className = ''
  }: Props = $props();

  const currentVoted = $derived(voted);
  let ready = $state(false);
  onMount(() => {
    ready = true;
  });

  function handleVote(helpful: boolean) {
    if (ready && !pending) onVote?.(helpful);
  }
</script>

<div
  class={cn(
    'relative shrink-0 overflow-hidden rounded-md glass-card p-5 select-none sm:p-6',
    className
  )}>
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div
      class="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
      <div class="flex flex-col gap-1">
        <h3
          class="text-base font-bold tracking-tight text-text-primary sm:text-lg">
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
          class="flex items-center justify-center gap-2 text-sm font-semibold text-accent sm:justify-start">
          <CheckCircle2 class="size-4 shrink-0" />
          <span>Thanks for your feedback!</span>
        </div>
      {:else}
        <div
          class="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
          <button
            type="button"
            class="relative inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-1.5 text-xs font-semibold text-emerald-600 transition-all hover:border-emerald-500/60 hover:bg-emerald-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:scale-95 disabled:cursor-wait disabled:opacity-50 dark:text-emerald-400"
            use:shortcut={{
              combo: buttonKey('helpfulYes'),
              label: 'Helpful: yes'
            }}
            disabled={!ready || pending}
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
            class="relative inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/5 px-3.5 py-1.5 text-xs font-semibold text-rose-600 transition-all hover:border-rose-500/60 hover:bg-rose-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 active:scale-95 disabled:cursor-wait disabled:opacity-50 dark:text-rose-400"
            use:shortcut={{combo: buttonKey('helpfulNo'), label: 'Helpful: no'}}
            disabled={!ready || pending}
            onclick={() => handleVote(false)}
            aria-label="No, this was not helpful">
            <ThumbsDown
              class="size-3.5 select-none"
              strokeWidth={1.75}
              absoluteStrokeWidth={true} />
            <span>No</span>
          </button>
        </div>
      {/if}

      <div
        class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
        {#if onFeedbackClick && currentVoted === null}
          <button
            type="button"
            class="relative inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-accent hover:underline focus-visible:underline focus-visible:outline-none"
            use:shortcut={{
              combo: buttonKey('shareFeedback'),
              label: 'Share your feedback',
              placement: 'after'
            }}
            onclick={onFeedbackClick}>
            <Send class="size-3.5" />
            Share your feedback
          </button>
        {/if}
        <button
          type="button"
          class="relative inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-accent hover:underline focus-visible:underline focus-visible:outline-none"
          use:shortcut={{
            combo: buttonKey('share'),
            label: shareLabel,
            placement: 'after'
          }}
          onclick={() => shortcutStore.runCommand(COMMAND_SHORTCUTS['/share'])}>
          <Share2 class="size-3.5" />
          {shareLabel}
        </button>
      </div>
    </div>
    <div
      class="relative hidden size-20 shrink-0 items-center justify-center sm:flex"
      aria-hidden="true">
      <div
        class="absolute inset-0 rounded-full border border-dashed border-border-subtle/80 bg-surface-elevated/40">
      </div>
      <MessageSquareQuote
        class="absolute top-4 left-4 size-9 fill-accent/15 text-accent"
        strokeWidth={1.5} />
      <AtSign
        class="absolute right-3 bottom-3 size-8 rounded-full bg-surface-card p-1 text-gh-green-3"
        strokeWidth={1.75} />
    </div>
  </div>
</div>

{#if error}<FieldMessage message={error} />{/if}
