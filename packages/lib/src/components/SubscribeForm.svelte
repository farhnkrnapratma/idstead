<script lang="ts">
    import { Mail, Paperclip, MailCheck } from '@lucide/svelte';
    import Card from './Card.svelte';
    import MailingForm from './MailingForm.svelte';
    import { ShinyText } from '#lib/index.ts';

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
                    class="absolute inset-0 border-border-subtle/80 bg-surface-elevated/40 sm:rounded-full sm:border sm:border-dashed">
                </div>
                <Mail
                    class="absolute top-4 left-4 size-9 fill-accent/15 text-accent-text"
                    strokeWidth={1.5} />
                <Paperclip
                    class="absolute right-3 bottom-3 size-8 rounded-full bg-surface-card p-1 text-gh-green-3"
                    strokeWidth={1.75} />
            </div>
            <div>
                <h4
                    id="{fieldId}-title"
                    class="text-base leading-snug font-bold text-balance text-text-primary sm:text-lg">
                    <ShinyText
                        text={title}
                        color="var(--color-accent)"
                        shineColor="var(--color-text-on-accent)"
                        speed={3} />
                </h4>
                <p
                    class="col-span-2 text-xs leading-relaxed text-pretty text-text-secondary sm:text-sm">
                    {description}
                </p>
            </div>
        </div>
        <div class="border-t border-border-subtle/60 px-3.5 py-3 sm:px-4">
            <div
                role="status"
                aria-atomic="true">
                {#if isDone}
                    <div class="flex items-start gap-3 py-1">
                        <MailCheck
                            class="mt-0.5 size-5 shrink-0 text-success-strong"
                            aria-hidden="true" />
                        <div>
                            <p class="text-base font-semibold text-text-primary">
                                Check your inbox
                            </p>
                            <p class="mt-1 text-sm leading-relaxed text-text-secondary">
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
