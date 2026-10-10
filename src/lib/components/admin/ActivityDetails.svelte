<script lang="ts">
    import type { AdminNotificationRow } from '#lib/adminActivity.ts';
    import {
        activityAuthor,
        activityMetadata,
        activityPageKind,
        isFeedbackActivity
    } from '#lib/adminActivity.ts';
    import { reportReasonLabel } from '#lib/reportReasons.ts';
    import { cn } from '#lib/utils/cn.ts';

    let { item, withAuthor = false }: { item: AdminNotificationRow; withAuthor?: boolean } =
        $props();

    const metadata = $derived(activityMetadata(item));
    const author = $derived(activityAuthor(item));
    const textClass = $derived(
        cn(
            'min-w-0 font-sans font-normal text-text-secondary',
            withAuthor ? 'truncate' : 'wrap-break-word'
        )
    );
</script>

{#if item.kind === 'comment_report'}
    <span
        title={metadata}
        class={textClass}>
        {#if withAuthor}Reported a comment by {author} for&nbsp;{:else}<span class="text-text-muted"
                >Reason:&nbsp;</span
            >{/if}{reportReasonLabel(item.meta?.reason ?? 'other')}
    </span>
    {#if item.report_status === 'resolved'}<span
            class="shrink-0 font-sans font-normal text-text-muted">Resolved</span
        >{/if}
{:else if item.kind === 'comment_new'}
    <span
        title={metadata}
        class={textClass}>
        {#if withAuthor}{author} commented:&nbsp;{:else}<span class="text-text-muted"
                >Comment:&nbsp;</span
            >{/if}“{item.meta?.comment ?? ''}”
    </span>
{:else if isFeedbackActivity(item)}
    {#if withAuthor}<span class={textClass}
            >Marked this {activityPageKind(item)} as {item.meta?.vote === 'yes' ?
                'helpful'
            :   'unhelpful'}</span
        >{/if}
{:else if withAuthor}
    <span
        title={metadata}
        class={textClass}>
        {item.kind === 'contact_message' ?
            'Sent a message via the contact form'
        :   'Submitted the feedback form'}
    </span>
{:else if metadata}
    <span
        title={metadata}
        class={textClass}>
        {metadata}
    </span>
{/if}
