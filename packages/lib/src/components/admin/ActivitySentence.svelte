<script lang="ts">
    import type { AdminNotificationRow } from '#lib/adminActivity.ts';
    import {
        activityAuthor,
        activityPageKind,
        activitySentence,
        isFeedbackActivity
    } from '#lib/adminActivity.ts';
    import { cn } from '@fkp/ui/utils/cn.ts';
    import ActivityPageLink from './ActivityPageLink.svelte';

    let { item, class: className = '' }: { item: AdminNotificationRow; class?: string } = $props();

    const feedback = $derived(isFeedbackActivity(item));
    const helpful = $derived(item.meta?.vote === 'yes');
    const author = $derived(activityAuthor(item));
    const pageKind = $derived(activityPageKind(item));
    const sentence = $derived(activitySentence(item));
</script>

<div
    data-activity-line="summary"
    title={sentence}
    class={cn('leading-snug wrap-break-word text-text-primary', className)}>
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

{#snippet pageLink()}
    <ActivityPageLink
        {item}
        class="font-bold" />
{/snippet}
