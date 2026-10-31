<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

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
        variant?: 'card' | 'sidebar';
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
        variant = 'card',
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

{#snippet voteButtons()}
    <Button
        type="ghost"
        size="sm"
        class="h-auto! justify-start! border border-success/30 bg-fg-success/5 px-3.5! py-1.5 leading-(--text-xs--line-height)! font-semibold whitespace-normal! text-fg-success! hover:border-success hover:bg-fg-success/15! active:scale-95 disabled:cursor-wait!"
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
        class="h-auto! justify-start! border border-danger/30 bg-fg-danger/5 px-3.5! py-1.5 leading-(--text-xs--line-height)! font-semibold whitespace-normal! text-fg-danger! hover:border-danger hover:bg-fg-danger/15! active:scale-95 disabled:cursor-wait!"
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
{/snippet}

{#snippet linkButtons()}
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
{/snippet}

{#if variant === 'sidebar'}
    <div class={cn('flex flex-col gap-3 select-none', className)}>
        <p class="text-2xs font-semibold tracking-wider text-fg-muted uppercase">
            {currentVoted === null ? 'Was this helpful?' : 'Thanks for your feedback!'}
        </p>
        {#if currentVoted === null}
            <div class="flex flex-wrap items-center gap-2">
                {@render voteButtons()}
            </div>
        {:else}
            <div class="flex items-center gap-2 text-xs font-semibold text-fg-accent">
                <CircleCheck class="size-4 shrink-0" />
                <span>Your vote was recorded.</span>
            </div>
        {/if}
        <div class="flex flex-col items-start gap-2">
            {@render linkButtons()}
        </div>
    </div>
{:else}
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
                    <div
                        class="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                        {@render voteButtons()}
                    </div>
                {/if}

                <div
                    class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
                    {@render linkButtons()}
                </div>
            </div>
            <div
                class="relative hidden size-20 shrink-0 items-center justify-center sm:flex"
                aria-hidden="true">
                <div
                    class="absolute inset-0 rounded-md border border-dashed border-line-subtle bg-surface">
                </div>
                <MessageSquareQuote
                    class="absolute top-4 left-4 size-9 fill-accent-tint text-fg-accent"
                    strokeWidth={1.5} />
                <AtSign
                    class="absolute right-3 bottom-3 size-8 rounded-md bg-surface p-1 text-success"
                    strokeWidth={1.75} />
            </div>
        </div>
    </div>
{/if}

{#if error}<FieldMessage message={error} />{/if}
