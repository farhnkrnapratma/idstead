<script lang="ts">
  import {
    Flag,
    Mail,
    MessageCircle,
    ThumbsDown,
    ThumbsUp
  } from '@lucide/svelte';
  import {cn} from '$lib/utils/cn';

  let {
    kind,
    vote,
    class: className = ''
  }: {kind: string; vote?: string | null; class?: string} = $props();

  const tone = $derived(
    kind === 'comment_report' ? 'report'
    : kind === 'comment_new' ? 'comment'
    : kind === 'contact_message' || kind === 'feedback_report' ? 'message'
    : kind === 'helpful' || vote === 'yes' ? 'helpful'
    : 'unhelpful'
  );

  const styles = {
    report: {
      icon: Flag,
      class:
        'border-activity-report/25 bg-activity-report/10 text-activity-report'
    },
    comment: {
      icon: MessageCircle,
      class:
        'border-activity-comment/25 bg-activity-comment/10 text-activity-comment'
    },
    message: {
      icon: Mail,
      class:
        'border-activity-message/25 bg-activity-message/10 text-activity-message'
    },
    helpful: {
      icon: ThumbsUp,
      class:
        'border-activity-helpful/25 bg-activity-helpful/10 text-activity-helpful'
    },
    unhelpful: {
      icon: ThumbsDown,
      class:
        'border-activity-unhelpful/25 bg-activity-unhelpful/10 text-activity-unhelpful'
    }
  };

  const Icon = $derived(styles[tone].icon);
</script>

<span
  aria-hidden="true"
  class={cn(
    'flex size-10 shrink-0 items-center justify-center rounded-md border',
    styles[tone].class,
    className
  )}>
  <Icon class="size-[1.125rem]" />
</span>
