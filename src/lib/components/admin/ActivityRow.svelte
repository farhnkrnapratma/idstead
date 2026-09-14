<script lang="ts">
  import {resolve} from '$app/paths';
  import {X} from '@lucide/svelte';
  import ActivityIcon from './ActivityIcon.svelte';
  import type {AdminNotificationRow} from '$lib/adminActivity';
  import {activityTimestamp, activityTimeZone} from '$lib/adminActivity';
  import {reportReasonLabel} from '$lib/reportReasons';
  import ActivityTimestamp from './ActivityTimestamp.svelte';
  import {cn} from '$lib/utils/cn';

  let {
    item,
    detail = false,
    timeZone,
    onSelect,
    onDelete,
    disabled = false
  }: {
    item: AdminNotificationRow;
    detail?: boolean;
    timeZone?: string;
    onSelect?: () => void;
    onDelete?: () => void;
    disabled?: boolean;
  } = $props();
  const feedback = $derived(
    item.kind === 'post_feedback' || item.kind === 'legal_feedback'
  );
  const helpful = $derived(item.meta?.vote === 'yes');
  const author = $derived(item.meta?.author ?? 'Anonymous');
  const title = $derived(item.page_title ?? 'Unavailable page');
  const pageKind = $derived(item.page_type === 'legal' ? 'page' : 'article');
  const unread = $derived(!item.read_at);
  const sentence = $derived(
    item.kind === 'comment_report' ?
      `Someone reported a comment by ${author} on the ${title} ${pageKind}.`
    : item.kind === 'comment_new' ?
      `${author} commented on the ${title} ${pageKind}.`
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
  data-unread={unread}
  class={cn(
    'group relative flex min-w-0 items-start gap-3 rounded-md border border-border-subtle px-3 py-2 font-sans transition-colors',
    unread ?
      'bg-notification-unread hover:bg-notification-unread-hover'
    : 'bg-surface-card hover:bg-surface-hover'
  )}>
  {#if onSelect}
    <button
      type="button"
      class="absolute inset-0 z-0 cursor-pointer rounded-md transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
      aria-label={`${sentence} ${metadata} ${activityTimestamp(item.created_at, timeZone)} · ${activityTimeZone(item.created_at, timeZone)}`}
      {disabled}
      onclick={onSelect}></button>
  {/if}
  <ActivityIcon
    kind={item.kind}
    vote={item.meta?.vote}
    class="pointer-events-none relative" />
  <div class="pointer-events-none relative min-w-0 flex-1">
    <div
      data-activity-line="summary"
      title={sentence}
      class={cn(
        'pr-7 leading-5 break-words text-text-primary',
        detail ? 'text-xs' : 'text-sm'
      )}>
      {#if item.kind === 'comment_report'}
        Someone reported a comment by <strong>{author}</strong>
        on the&nbsp;{@render pageLink()}&nbsp;{pageKind}.
      {:else if feedback}
        Someone marked the&nbsp;{@render pageLink()}&nbsp;{pageKind} as
        <strong>{helpful ? 'helpful' : 'unhelpful'}</strong>.
      {:else if item.kind === 'comment_new'}
        <strong>{author}</strong> commented on the&nbsp;{@render pageLink()}&nbsp;{pageKind}.
      {:else}{sentence}{/if}
    </div>
    <div
      data-activity-line="metadata"
      class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-7 text-xs leading-4">
      {#if item.kind === 'comment_report'}
        <span
          title={metadata}
          class="min-w-0 font-sans font-normal break-words text-text-secondary">
          <span class="text-text-muted">Reason:&nbsp;</span><span
            class="font-normal text-text-secondary"
            >{reportReasonLabel(item.meta?.reason ?? 'other')}</span
          >{#if item.report_status === 'resolved'}<span class="text-text-muted"
              >&nbsp;&middot;&nbsp;Resolved</span
            >{/if}
        </span>
      {:else if item.kind === 'comment_new'}
        <span
          title={metadata}
          class="min-w-0 font-sans font-normal break-words text-text-secondary">
          <span class="text-text-muted">Comment:&nbsp;</span><span
            class="font-normal text-text-secondary"
            >“{item.meta?.comment ?? ''}”</span>
        </span>
      {:else if metadata}
        <span
          title={metadata}
          class="min-w-0 font-sans font-normal break-words text-text-secondary">
          {metadata}
        </span>
      {/if}
      <ActivityTimestamp
        date={item.created_at}
        {timeZone}
        class="pointer-events-auto shrink-0" />
    </div>
  </div>
  {#if onDelete}
    <button
      type="button"
      {disabled}
      aria-label="Delete notification"
      title="Permanently delete notification"
      class="absolute top-1/2 right-1.5 z-20 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-danger-subtle hover:text-danger focus-visible:outline-2 focus-visible:outline-focus-ring disabled:opacity-50"
      onclick={onDelete}><X class="size-4" /></button>
  {/if}
</div>

{#snippet pageLink()}
  {#if item.page_url}
    <a
      href={resolve(...([item.page_url] as Parameters<typeof resolve>))}
      target="_blank"
      rel="noopener noreferrer"
      class="pointer-events-auto relative font-bold hover:text-accent hover:underline focus-visible:text-accent focus-visible:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
      onclick={event => event.stopPropagation()}>{title}</a>
  {:else}<strong>{title}</strong>{/if}
{/snippet}
