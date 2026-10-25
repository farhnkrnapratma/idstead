<script lang="ts">
    import { buttonKey, COMMAND_SHORTCUTS } from '@idstead/ui/shortcuts.ts';
    import { shortcutStore } from '@idstead/ui/stores/shortcutStore.svelte.ts';
    import { onMount } from 'svelte';
    import {
        ThumbsUp,
        ThumbsDown,
        CircleCheck,
        Share2,
        Send,
        MessageSquareQuote,
        AtSign
    } from '@lucide/svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import FieldMessage from '@idstead/ui/components/FieldMessage.svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';

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
        <div class="flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
            <div class="flex flex-col gap-1">
                <h3 class="type-card-title">
                    {title}
                </h3>
                {#if currentVoted === null}
                    <p class="font-sans text-xs text-fg-secondary sm:text-sm">
                        {subtitle}
                    </p>
                {/if}
            </div>

            {#if currentVoted !== null}
                <div
                    class="flex items-center justify-center gap-2 text-sm font-semibold text-fg-accent sm:justify-start">
                    <CircleCheck class="size-4 shrink-0" />
                    <span>Thanks for your feedback!</span>
                </div>
            {:else}
                <div class="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                    <Button
                        type="ghost"
                        size="sm"
                        class="h-auto! justify-start! border border-fg-success/30 bg-fg-success/5 px-3.5! py-1.5 leading-(--text-xs--line-height)! font-semibold whitespace-normal! text-fg-success! hover:border-fg-success/60 hover:bg-fg-success/15! active:scale-95 disabled:cursor-wait!"
                        keyboardShortcut={buttonKey('helpfulYes')}
                        shortcutLabel="Helpful: yes"
                        disabled={!ready || pending}
                        onclick={() => handleVote(true)}
                        aria-label="Yes, this was helpful">
                        <ThumbsUp
                            class="size-3.5 select-none"
                            strokeWidth={1.75}
                            absoluteStrokeWidth={true} />
                        <span>Yes</span>
                    </Button>
                    <Button
                        type="ghost"
                        size="sm"
                        class="h-auto! justify-start! border border-fg-danger/30 bg-fg-danger/5 px-3.5! py-1.5 leading-(--text-xs--line-height)! font-semibold whitespace-normal! text-fg-danger! hover:border-fg-danger/60 hover:bg-fg-danger/15! active:scale-95 disabled:cursor-wait!"
                        keyboardShortcut={buttonKey('helpfulNo')}
                        shortcutLabel="Helpful: no"
                        disabled={!ready || pending}
                        onclick={() => handleVote(false)}
                        aria-label="No, this was not helpful">
                        <ThumbsDown
                            class="size-3.5 select-none"
                            strokeWidth={1.75}
                            absoluteStrokeWidth={true} />
                        <span>No</span>
                    </Button>
                </div>
            {/if}

            <div
                class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
                {#if onFeedbackClick && currentVoted === null}
                    <Button
                        type="ghost"
                        size="sm"
                        class="h-auto! w-fit justify-start! rounded-none p-0! leading-(--text-xs--line-height)! font-medium whitespace-normal! text-fg-accent! focus-visible:outline-none"
                        keyboardShortcut={buttonKey('shareFeedback')}
                        shortcutLabel="Share your feedback"
                        shortcutPlacement="after"
                        onclick={onFeedbackClick}>
                        <Send class="size-3.5" />
                        Share your feedback
                    </Button>
                {/if}
                <Button
                    type="ghost"
                    size="sm"
                    class="h-auto! w-fit justify-start! rounded-none p-0! leading-(--text-xs--line-height)! font-medium whitespace-normal! text-fg-accent! focus-visible:outline-none"
                    keyboardShortcut={buttonKey('share')}
                    shortcutLabel={shareLabel}
                    shortcutPlacement="after"
                    onclick={() => shortcutStore.runCommand(COMMAND_SHORTCUTS['/share'])}>
                    <Share2 class="size-3.5" />
                    {shareLabel}
                </Button>
            </div>
        </div>
        <div
            class="relative hidden size-20 shrink-0 items-center justify-center sm:flex"
            aria-hidden="true">
            <div
                class="absolute inset-0 rounded-full border border-dashed border-line-subtle/80 bg-surface/40">
            </div>
            <MessageSquareQuote
                class="absolute top-4 left-4 size-9 fill-accent/15 text-fg-accent"
                strokeWidth={1.5} />
            <AtSign
                class="absolute right-3 bottom-3 size-8 rounded-full bg-surface p-1 text-success"
                strokeWidth={1.75} />
        </div>
    </div>
</div>

{#if error}<FieldMessage message={error} />{/if}
