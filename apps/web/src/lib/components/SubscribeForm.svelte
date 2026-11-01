<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { MailCheck, MailPlus } from '@lucide/svelte';
    import CalloutCard from './CalloutCard.svelte';
    import MailingForm from './MailingForm.svelte';

    let {
        title = 'Subscribe to Stay Updated',
        description = 'Stay updated by email whenever something new is published. You can unsubscribe anytime.',
        class: className = ''
    }: { title?: string; description?: string; class?: string } = $props();

    let isDone = $state(false);
</script>

<CalloutCard
    icon={MailPlus}
    {title}
    {description}
    class={className}>
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
</CalloutCard>
