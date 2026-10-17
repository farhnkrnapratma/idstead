<script lang="ts">
    import { X } from '@lucide/svelte';
    import ActivityIcon from './ActivityIcon.svelte';
    import type { AdminNotificationRow } from '#lib/adminActivity.ts';
    import {
        activityMetadata,
        activitySentence,
        activityTimestamp,
        activityTimeZone
    } from '#lib/adminActivity.ts';
    import { adminDisplayStore } from '#lib/stores/adminDisplayStore.svelte.ts';
    import ActivityTimestamp from './ActivityTimestamp.svelte';
    import ActivitySentence from './ActivitySentence.svelte';
    import ActivityDetails from './ActivityDetails.svelte';
    import { cn } from '#lib/utils/cn.ts';

    let {
        item,
        detail = false,
        timeZone,
        onSelect,
        onDelete,
        disabled = false,
        bordered = true
    }: {
        item: AdminNotificationRow;
        detail?: boolean;
        timeZone?: string;
        onSelect?: () => void;
        onDelete?: () => void;
        disabled?: boolean;
        bordered?: boolean;
    } = $props();
    const unread = $derived(!item.read_at);
</script>

<div
    data-activity-row={item.id}
    data-unread={unread}
    class={cn(
        'group relative flex min-w-0 items-start gap-3 px-3 py-2 font-sans transition-colors',
        bordered && 'rounded-md border border-border-subtle',
        unread ?
            'bg-notification-unread hover:bg-notification-unread-hover'
        :   'bg-surface-card hover:bg-surface-hover'
    )}>
    {#if onSelect}
        <button
            type="button"
            class="absolute inset-0 z-0 cursor-pointer rounded-md transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
            aria-label={`${activitySentence(item)} ${activityMetadata(item)} ${activityTimestamp(item.created_at, timeZone, adminDisplayStore.current)} · ${activityTimeZone(item.created_at, timeZone)}`}
            {disabled}
            onclick={onSelect}></button>
    {/if}
    <ActivityIcon
        kind={item.kind}
        vote={item.meta?.vote}
        class="pointer-events-none relative" />
    <div class="pointer-events-none relative min-w-0 flex-1">
        <ActivitySentence
            {item}
            class={cn('pr-7', detail ? 'text-xs' : 'text-sm')} />
        <div
            data-activity-line="metadata"
            class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-7 text-xs leading-snug">
            <ActivityDetails {item} />
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
