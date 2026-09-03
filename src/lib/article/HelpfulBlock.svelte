<script lang="ts">
  import {ThumbsUp, ThumbsDown, CheckCircle2} from '@lucide/svelte';
  import Button from '../components/Button.svelte';
  import {cn} from '../utils/cn';

  interface Props {
    title?: string;
    onVote?: (helpful: boolean) => void;
    class?: string;
  }

  let {
    title = 'Was this helpful?',
    onVote,
    class: className = ''
  }: Props = $props();

  let voted = $state<boolean | null>(null);

  function handleVote(helpful: boolean) {
    voted = helpful;
    onVote?.(helpful);
  }
</script>

<div
  class={cn('flex flex-col gap-2 px-0 py-2 text-left select-none', className)}>
  <span class="font-sans-title text-xs font-semibold text-text-secondary"
    >{title}</span>

  {#if voted !== null}
    <span
      class="flex items-center gap-1.5 font-sans-title text-xs font-semibold text-copilot">
      <CheckCircle2 class="size-3.5 shrink-0" />
      Thanks for your feedback!
    </span>
  {:else}
    <div class="flex items-center gap-1.5">
      <Button
        type="secondary"
        size="xs"
        class="text-text-secondary hover:border-copilot hover:text-text-primary"
        onclick={() => handleVote(true)}>
        {#snippet leading()}
          <ThumbsUp
            class="size-3.5 select-none"
            strokeWidth={1.75}
            absoluteStrokeWidth={true} />
        {/snippet}
        <span>Yes</span>
      </Button>
      <Button
        type="secondary"
        size="xs"
        class="text-text-secondary hover:border-copilot hover:text-text-primary"
        onclick={() => handleVote(false)}>
        {#snippet leading()}
          <ThumbsDown
            class="size-3.5 select-none"
            strokeWidth={1.75}
            absoluteStrokeWidth={true} />
        {/snippet}
        <span>No</span>
      </Button>
    </div>
  {/if}
</div>
