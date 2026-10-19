<script lang="ts">
    import { onMount } from 'svelte';
    import { MailCheck } from '@lucide/svelte';
    import Button from '@fkp/ui/components/Button.svelte';
    import FormField from '@fkp/ui/components/FormField.svelte';
    import Input from '@fkp/ui/components/Input.svelte';
    import { mailingEmailError, submitMailing, type MailingAction } from '#lib/mailing.ts';
    import { buttonKey } from '@fkp/ui/shortcuts.ts';
    import { toastStore } from '@fkp/ui/stores/toastStore.svelte.ts';
    import {
        turnstileWidget,
        executeTurnstile,
        resetTurnstile,
        turnstileSiteKey
    } from '#lib/utils/turnstile.ts';

    let {
        action = 'subscribe',
        initialEmail = '',
        autoSubmit = false,
        onSuccess,
        onCancel
    }: {
        action?: MailingAction;
        initialEmail?: string;
        autoSubmit?: boolean;
        onSuccess: () => void;
        onCancel?: () => void;
    } = $props();

    let email = $state('');
    let error = $state('');
    let isSubmitting = $state(false);
    let turnstileEl = $state<HTMLDivElement | null>(null);
    let form = $state<HTMLFormElement | null>(null);
    const id = $props.id();
    const label = $derived(action === 'subscribe' ? 'Subscribe' : 'Unsubscribe');
    const controller = new AbortController();

    async function submit(event?: SubmitEvent) {
        event?.preventDefault();
        if (isSubmitting) return;
        error = mailingEmailError(email);
        if (error) {
            form?.querySelector('input')?.focus();
            return;
        }
        isSubmitting = true;
        try {
            const message = await submitMailing(
                action,
                email,
                () => executeTurnstile(turnstileEl),
                controller.signal
            );
            if (controller.signal.aborted) return;
            toastStore.success(message);
            onSuccess();
        } catch (cause) {
            if (!controller.signal.aborted)
                error =
                    cause instanceof Error ?
                        cause.message
                    :   `Could not ${action} right now. Please try again.`;
        } finally {
            isSubmitting = false;
            resetTurnstile(turnstileEl);
        }
    }

    onMount(() => {
        email = initialEmail;
        if (autoSubmit) void submit();
        return () => controller.abort();
    });
</script>

<form
    bind:this={form}
    onsubmit={submit}
    aria-busy={isSubmitting}
    novalidate>
    <div class={onCancel ? 'flex flex-col gap-4' : 'flex items-start gap-3'}>
        <div class="min-w-0 flex-1">
            <FormField
                {id}
                {error}
                hideFeedbackSlot>
                <Input
                    {id}
                    name="email"
                    type="email"
                    size="sm"
                    autocomplete="email"
                    placeholder="Enter your email"
                    aria-label="Email address"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                    bind:value={email}
                    error={Boolean(error)}
                    disabled={isSubmitting}
                    oninput={() => (error = '')} />
            </FormField>
        </div>
        <div class="flex shrink-0 justify-end gap-2">
            {#if onCancel}<Button
                    size="sm"
                    onclick={onCancel}>Cancel</Button
                >{/if}
            <Button
                type="primary"
                htmlType="submit"
                size="sm"
                responsiveIconOnly={!onCancel}
                isLoading={isSubmitting}
                disabled={isSubmitting}
                keyboardShortcut={onCancel ? buttonKey('formSubmit') : buttonKey('subscribe')}
                shortcutLabel={label}>
                {isSubmitting ?
                    action === 'subscribe' ?
                        'Subscribing…'
                    :   'Unsubscribing…'
                :   label}
                {#snippet leading()}<MailCheck
                        class="size-4"
                        aria-hidden="true" />{/snippet}
            </Button>
        </div>
    </div>
    <div
        bind:this={turnstileEl}
        use:turnstileWidget={{
            sitekey: turnstileSiteKey,
            size: 'flexible',
            action,
            theme: 'auto',
            appearance: 'interaction-only',
            execution: 'execute'
        }}>
    </div>
</form>
