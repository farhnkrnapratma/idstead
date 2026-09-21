<script lang="ts">
  import {Mail, Paperclip, MailCheck} from '@lucide/svelte';
  import Card from './Card.svelte';
  import Button from './Button.svelte';
  import FormField from './FormField.svelte';
  import Input from './Input.svelte';
  import {ShinyText} from '$lib';
  import {toastStore} from '$lib/stores/toastStore.svelte';
  import {
    turnstileWidget,
    executeTurnstile,
    resetTurnstile,
    turnstileSiteKey
  } from '$lib/utils/turnstile';
  import {emailError} from '$lib/fieldValidation';

  let {
    title = 'Subscribe to Stay Updated',
    description = 'Stay updated by email whenever something new is published. You can unsubscribe anytime.',
    class: className = ''
  }: {title?: string; description?: string; class?: string} = $props();

  let email = $state('');
  let error = $state('');
  let isSubmitting = $state(false);
  let isDone = $state(false);
  let turnstileEl = $state<HTMLDivElement | null>(null);

  const fieldId = $props.id();

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    const value = email.trim();
    error = !value ? 'Enter your email address.' : emailError(value);
    if (error) {
      (event.currentTarget as HTMLFormElement).querySelector('input')?.focus();
      return;
    }
    error = '';
    isSubmitting = true;

    try {
      const turnstileToken = await executeTurnstile(turnstileEl);
      if (!turnstileToken) {
        error = 'Verification failed. Please try again.';
        return;
      }

      const res = await fetch('/api/internal/subscribe', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: value, turnstileToken})
      });
      const result = (await res.json().catch(() => null)) as {
        message?: string;
        error?: {message?: string};
      } | null;

      if (!res.ok) {
        error =
          result?.error?.message
          || 'Could not subscribe right now. Please try again.';
        return;
      }

      isDone = true;
      email = '';
      toastStore.success(
        result?.message ?? 'Check your inbox to confirm the subscription.'
      );
    } catch {
      error = 'Could not subscribe right now. Please try again.';
    } finally {
      isSubmitting = false;
      resetTurnstile(turnstileEl);
    }
  }
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
          class="absolute top-4 left-4 size-9 fill-accent/15 text-accent"
          strokeWidth={1.5} />
        <Paperclip
          class="absolute right-3 bottom-3 size-8 rounded-full bg-surface-card p-1 text-gh-green-3"
          strokeWidth={1.75} />
      </div>
      <div>
        <h4
          class="text-base leading-snug font-bold text-balance text-text-primary sm:text-lg">
          <ShinyText
            text={title}
            color="var(--color-accent)"
            shineColor="var(--color-text-on-accent)"
            speed={3}
            class="motion-reduce:animate-none!" />
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
        <form
          onsubmit={handleSubmit}
          aria-busy={isSubmitting}
          novalidate>
          <FormField
            id={fieldId}
            {error}
            hideFeedbackSlot>
            <div class="inline-flex gap-3">
              <Input
                id={fieldId}
                name="email"
                type="email"
                size="sm"
                autocomplete="email"
                placeholder="Enter your email"
                aria-label="Email address"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                bind:value={email}
                error={Boolean(error)}
                disabled={isSubmitting}
                oninput={() => (error = '')} />
              <Button
                type="primary"
                htmlType="submit"
                size="sm"
                responsiveIconOnly
                isLoading={isSubmitting}
                disabled={isSubmitting}
                class="shrink-0">
                {isSubmitting ? 'Subscribing…' : 'Subscribe'}
                {#snippet leading()}
                  <MailCheck
                    class="size-4"
                    aria-hidden="true" />
                {/snippet}
              </Button>
            </div>
          </FormField>
        </form>
      {/if}

      <div
        bind:this={turnstileEl}
        use:turnstileWidget={{
          sitekey: turnstileSiteKey,
          size: 'flexible',
          action: 'subscribe',
          theme: 'auto',
          appearance: 'interaction-only',
          execution: 'execute'
        }}>
      </div>
    </div>
  </Card>
</section>
