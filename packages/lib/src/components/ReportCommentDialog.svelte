<script lang="ts">
    import { onDestroy } from 'svelte';
    import { FieldValidation } from '@fkp/domain/fieldValidation.ts';
    import { Circle, CircleDot } from '@lucide/svelte';
    import Dialog from '@fkp/ui/components/Dialog.svelte';
    import Button from '@fkp/ui/components/Button.svelte';
    import FormField from '@fkp/ui/components/FormField.svelte';
    import Textarea from '@fkp/ui/components/Textarea.svelte';
    import {
        turnstileWidget,
        executeTurnstile,
        resetTurnstile,
        turnstileSiteKey
    } from '#lib/utils/turnstile.ts';
    import { toastStore } from '@fkp/ui/stores/toastStore.svelte.ts';
    import { cn } from '@fkp/ui/utils/cn.ts';
    import { shortcut } from '@fkp/ui/utils/shortcut.svelte.ts';
    import {
        REPORT_REASONS,
        reportReasonColor,
        reportReasonIcon,
        type ReportReasonId
    } from '#lib/reportReasons.ts';

    interface CommentInfo {
        id: string;
        author_name?: string;
        content: string;
    }

    interface Props {
        isOpen?: boolean;
        comment: CommentInfo | null;
        onClose?: () => void;
    }

    let { isOpen = $bindable(false), comment = null, onClose }: Props = $props();

    const REASONS = REPORT_REASONS.map(r => ({ ...r, icon: reportReasonIcon(r.id) }));

    let selectedReason = $state<ReportReasonId>('spam');
    let details = $state('');
    let detailsError = $state('');
    let detailsValid = $state(false);
    const validation = new FieldValidation();
    validation.register('details', {
        value: () => details,
        baseline: () => '',
        validate: (value: string) =>
            value.trim().length > 500 ? 'Use at most 500 characters.' : '',
        report: result => {
            detailsError = result.error;
            detailsValid = result.valid;
        }
    });
    onDestroy(() => validation.destroy());
    let isSubmitting = $state(false);
    let turnstileEl = $state<HTMLDivElement | null>(null);

    function resetForm() {
        selectedReason = 'spam';
        details = '';
        validation.reset();
        isSubmitting = false;
        resetTurnstile(turnstileEl);
    }

    function handleClose() {
        resetForm();
        isOpen = false;
        onClose?.();
    }

    async function submitReport() {
        if (!comment?.id) return;
        if (!(await validation.submit(undefined, true))) return;

        let turnstileToken = '';
        if (turnstileSiteKey) {
            turnstileToken = await executeTurnstile(turnstileEl);
            if (!turnstileToken) {
                toastStore.error('Please complete security verification.');
                return;
            }
        }

        isSubmitting = true;

        try {
            const res = await fetch('/api/internal/blog/comments/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commentId: comment.id,
                    reason: selectedReason,
                    details: details.trim(),
                    turnstileToken
                })
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                toastStore.error(
                    data?.error?.message
                        || data?.message
                        || 'Failed to submit report. Please try again.'
                );
                resetTurnstile(turnstileEl);
                isSubmitting = false;
                return;
            }

            toastStore.success('Report submitted. Thank you for keeping our community safe.');
            handleClose();
        } catch {
            toastStore.error('Network error while submitting report.');
            resetTurnstile(turnstileEl);
            isSubmitting = false;
        }
    }
</script>

<Dialog
    bind:isOpen
    title="Report comment"
    description="Select the reason that best describes why this comment violates policy."
    size="4xl"
    compact
    scrollBody
    onClose={handleClose}>
    {#if comment}
        <form
            id="report-form"
            novalidate
            autocomplete="off"
            class="flex flex-col gap-2.5"
            onsubmit={event => {
                event.preventDefault();
                void submitReport();
            }}>
            <div
                class="rounded-md border border-border-subtle bg-surface-card/60 p-2.5 text-xs text-text-secondary">
                <span class="font-semibold text-text-primary"
                    >{comment.author_name || 'Author'}:</span>
                <p class="mt-0.5 line-clamp-2 text-text-muted italic">
                    "{comment.content}"
                </p>
            </div>

            <div class="flex flex-col gap-1.5">
                <div
                    class="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3"
                    role="radiogroup"
                    aria-label="Report reason">
                    {#each REASONS as r, index (r.id)}
                        <label
                            use:shortcut={{ combo: String(index + 1), label: r.label }}
                            class={cn(
                                'group relative flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-all select-none has-focus-visible:outline-2 has-focus-visible:outline-focus-ring',
                                selectedReason === r.id ?
                                    'border-accent bg-accent/10'
                                :   'border-border-subtle/70 bg-surface-card/60 hover:border-accent/40 hover:bg-surface-card'
                            )}>
                            <input
                                type="radio"
                                name="report-reason"
                                value={r.id}
                                checked={selectedReason === r.id}
                                onchange={() => (selectedReason = r.id)}
                                onkeydown={event => {
                                    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey)
                                        event.preventDefault();
                                }}
                                class="sr-only" />
                            <div
                                style:color={reportReasonColor(r.id)}
                                class={cn(
                                    'mt-0.5 shrink-0 transition-transform group-hover:scale-105'
                                )}>
                                <r.icon class="size-3.5" />
                            </div>
                            <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span
                                    class="text-2xs font-semibold text-text-primary transition-colors group-hover:text-accent-text">
                                    {r.label}
                                </span>
                                <span class="text-3xs leading-relaxed text-text-muted">
                                    {r.description}
                                </span>
                            </span>
                            <span
                                class="relative mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
                                <Circle
                                    class={cn(
                                        'absolute size-3.5 transition-all duration-200',
                                        selectedReason === r.id ?
                                            'scale-0 opacity-0'
                                        :   'scale-100 text-text-muted opacity-100 group-hover:text-text-secondary'
                                    )} />
                                <CircleDot
                                    class={cn(
                                        'absolute size-3.5 transition-all duration-200',
                                        selectedReason === r.id ?
                                            'scale-100 text-accent-text opacity-100'
                                        :   'scale-0 opacity-0'
                                    )} />
                            </span>
                        </label>
                    {/each}
                </div>
            </div>

            <FormField
                id="report-details"
                label="Additional details (optional)"
                variant="floating"
                error={detailsError}
                valid={detailsValid}
                maxlength={500}
                currentLength={details.length}
                counter={`${details.length}/500`}>
                <Textarea
                    id="report-details"
                    rows={2}
                    maxlength={500}
                    error={!!detailsError}
                    valid={detailsValid}
                    oninput={() => validation.input('details')}
                    onblur={() => {
                        void validation.check('details');
                    }}
                    bind:value={details} />
            </FormField>

            {#if turnstileSiteKey}
                <div
                    bind:this={turnstileEl}
                    class="turnstile-widget select-none"
                    use:turnstileWidget={{
                        sitekey: turnstileSiteKey,
                        action: 'report-comment',
                        size: 'flexible',
                        theme: 'auto',
                        appearance: 'interaction-only',
                        execution: 'execute'
                    }}>
                </div>
            {/if}
        </form>
    {/if}

    {#snippet footer()}
        <div class="grid w-full grid-cols-2 gap-2.5">
            <Button
                type="secondary"
                size="sm"
                fullWidth
                disabled={isSubmitting}
                keyboardShortcut="C"
                shortcutLabel="Cancel report"
                onclick={handleClose}>
                Cancel
            </Button>
            <Button
                type="danger"
                size="sm"
                fullWidth
                disabled={isSubmitting}
                htmlType="submit"
                form="report-form"
                aria-keyshortcuts="Control+Enter Meta+Enter"
                keyboardShortcut="S"
                shortcutLabel="Submit report">
                {isSubmitting ? 'Submitting…' : 'Submit report'}
            </Button>
        </div>
    {/snippet}
</Dialog>
