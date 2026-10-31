<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { Mail, Paperclip, MailCheck } from '@lucide/svelte';
    import Card from '@idstead/ui/components/Card.svelte';
    import MailingForm from './MailingForm.svelte';
    import { GradientText } from '@idstead/ui';

    let {
        title = 'Subscribe to Stay Updated',
        description = 'Stay updated by email whenever something new is published. You can unsubscribe anytime.',
        class: className = ''
    }: { title?: string; description?: string; class?: string } = $props();

    let isDone = $state(false);
    const fieldId = $props.id();
</script>

<section
    class={className}
    aria-labelledby="{fieldId}-title">
    <Card
        density="none"
        class="text-left">
        <div
            class="flex flex-col justify-between gap-4 gap-x-4 gap-y-1 p-3 sm:flex-row sm:items-center sm:p-4">
            <div
                class="relative size-20 shrink-0 items-center justify-center sm:flex"
                aria-hidden="true">
                <div
                    class="absolute inset-0 border-line-subtle bg-surface sm:border sm:border-dashed">
                </div>
                <Mail
                    class="absolute top-4 left-4 size-9 fill-accent-tint text-fg-accent"
                    strokeWidth={1.5} />
                <Paperclip
                    class="absolute right-3 bottom-3 size-8 rounded-md bg-surface p-1 text-success"
                    strokeWidth={1.75} />
            </div>
            <div>
                <h4
                    id="{fieldId}-title"
                    class="type-card-title text-balance">
                    <GradientText>{title}</GradientText>
                </h4>
                <p class="col-span-2 type-body text-pretty text-fg-secondary">
                    {description}
                </p>
            </div>
        </div>
        <div class="border-t border-line-subtle px-3.5 py-3 sm:px-4">
            <div
                role="status"
                aria-atomic="true">
                {#if isDone}
                    <div class="flex items-start gap-3 py-1">
                        <MailCheck
                            class="mt-0.5 size-5 shrink-0 text-fg-success"
                            aria-hidden="true" />
                        <div>
                            <p class="text-base font-semibold text-fg">Check your inbox</p>
                            <p class="mt-1 text-sm leading-relaxed text-fg-secondary">
                                Open the confirmation email to finish subscribing.
                            </p>
                        </div>
                    </div>
                {/if}
            </div>
            {#if !isDone}
                <MailingForm onSuccess={() => (isDone = true)} />
            {/if}
        </div>
    </Card>
</section>
