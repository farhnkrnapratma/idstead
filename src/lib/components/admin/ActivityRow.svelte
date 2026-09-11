<script lang="ts">
  import {resolve} from '$app/paths';
  import {
    Flag,
    MessageCircle,
    ThumbsUp,
    ThumbsDown,
    Mail,
    MessageSquareText,
    X
  } from '@lucide/svelte';
  import type {AdminNotificationRow} from '$lib/adminActivity';
  import {activityTimestamp, activityTimeZone} from '$lib/adminActivity';
  import {reportReasonColor, reportReasonLabel} from '$lib/reportReasons';
  import ActivityTimestamp from './ActivityTimestamp.svelte';
  import {cn} from '$lib/utils/cn';

  let {
    item,
    detail = false,
    onSelect,
    onDelete,
    disabled = false
  }: {
    item: AdminNotificationRow;
    detail?: boolean;
    onSelect?: () => void;
    onDelete?: () => void;
    disabled?: boolean;
  } = $props();
  const feedback = $derived(
    item.kind === 'post_feedback' || item.kind === 'legal_feedback'
  );
  const helpful = $derived(item.meta?.vote === 'yes');
  const Icon = $derived(
    item.kind === 'comment_report' ? Flag
    : item.kind === 'comment_new' ? MessageCircle
    : feedback ?
      helpful ? ThumbsUp
      : ThumbsDown
    : item.kind === 'contact_message' ? Mail
    : MessageSquareText
  );
  const color = $derived(
    item.kind === 'comment_report' ? 'text-activity-report'
    : item.kind === 'comment_new' ? 'text-activity-comment'
    : feedback ?
      helpful ? 'text-activity-helpful'
      : 'text-activity-unhelpful'
    : 'text-accent'
  );
  const author = $derived(item.meta?.author ?? 'Anonymous');
  const title = $derived(item.page_title ?? 'Unavailable page');
  const pageKind = $derived(item.page_type === 'legal' ? 'page' : 'article');
  const prefix = $derived(
    item.kind === 'comment_report' ? 'Reported at'
    : feedback ? 'Clicked at'
    : 'Sent at'
  );
  const sentence = $derived(
    item.kind === 'comment_report' ?
      `Someone reported a comment by ${author} on ${title}.`
    : item.kind === 'comment_new' ?
      `${author} commented on the ${title} article.`
    : feedback ?
      `Someone marked the ${title} ${pageKind} as ${helpful ? 'helpful' : 'unhelpful'}.`
    : item.kind === 'contact_message' ?
      'Someone sent a message through the contact form.'
    : 'Someone submitted the feedback form.'
  );
  const metadata = $derived(
    item.kind === 'comment_report' ?
      `Reason: ${reportReasonLabel(item.meta?.reason ?? 'other')}${item.report_status === 'resolved' ? ' · Resolved' : ''}`
    : item.kind === 'comment_new' ? `Comment: “${item.meta?.comment ?? ''}”`
    : feedback ? ''
    : 'Check your email inbox.'
  );
</script>

<div
  data-activity-row={item.id}
  class={cn(
    'group relative flex min-w-0 gap-2 rounded-md px-2 py-2 font-sans',
    item.read_at || detail ? '' : 'bg-accent-subtle/40'
  )}>
  {#if onSelect}
    <button
      type="button"
      class="absolute inset-0 z-0 cursor-pointer rounded-md transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
      aria-label={`${sentence} ${metadata} ${prefix}: ${activityTimestamp(item.created_at)} · ${activityTimeZone(item.created_at)}`}
      onclick={onSelect}></button>
  {/if}
  <span
    aria-hidden="true"
    class={`pointer-events-none relative flex h-9 w-8 shrink-0 items-center justify-center rounded-md border border-current/25 bg-current/5 ${color}`}>
    <Icon class="size-4" />
  </span>
  <div class="pointer-events-none relative min-w-0 flex-1">
    <div
      data-activity-line="summary"
      title={sentence}
      class={cn(
        'pr-5 text-xs leading-5 text-text-primary',
        detail && !feedback ? 'break-words' : 'truncate'
      )}>
      {#if feedback && detail}
        Marked as <strong>{helpful ? 'helpful' : 'unhelpful'}</strong>
      {:else if item.kind === 'comment_report'}
        Someone reported a comment by <strong>{author}</strong>
        on&nbsp;{@render pageLink()}.
      {:else if feedback}
        Someone marked the&nbsp;{@render pageLink()}&nbsp;{pageKind} as
        <strong>{helpful ? 'helpful' : 'unhelpful'}</strong>.
      {:else if item.kind === 'comment_new'}
        <strong>{author}</strong> commented on the&nbsp;{@render pageLink()}&nbsp;article.
      {:else}{sentence}{/if}
    </div>
    <div
      data-activity-line="metadata"
      class="flex min-w-0 items-center gap-1 text-2xs leading-4">
      <span
        title={metadata}
        class="min-w-0 flex-1 truncate font-sans font-normal text-text-secondary">
        {#if item.kind === 'comment_report'}
          Reason: <strong
            style:color={reportReasonColor(item.meta?.reason ?? 'other')}
            >{reportReasonLabel(item.meta?.reason ?? 'other')}</strong
          >{#if item.report_status === 'resolved'}
            · Resolved{/if}
        {:else}{metadata}{/if}
      </span>
      {#if metadata}<span
          aria-hidden="true"
          class="shrink-0 text-text-muted">·</span
        >{/if}
      <ActivityTimestamp
        date={item.created_at}
        {prefix}
        compact={!detail}
        class="pointer-events-auto ml-auto" />
    </div>
  </div>
  {#if onDelete}
    <button
      type="button"
      {disabled}
      aria-label="Delete notification"
      title="Permanently delete notification"
      class="absolute top-2 right-1 z-20 flex size-5 cursor-pointer items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-danger-subtle hover:text-danger focus-visible:outline-2 focus-visible:outline-focus-ring disabled:opacity-50"
      onclick={onDelete}><X class="size-3" /></button>
  {/if}
</div>

{#snippet pageLink()}
  {#if item.page_url}
    <a
      href={resolve(...([item.page_url] as Parameters<typeof resolve>))}
      target="_blank"
      rel="noopener noreferrer"
      class="pointer-events-auto relative font-bold underline decoration-border-strong underline-offset-2 hover:text-accent hover:decoration-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-focus-ring"
      onclick={event => event.stopPropagation()}>{title}</a>
  {:else}<strong>{title}</strong>{/if}
{/snippet}
