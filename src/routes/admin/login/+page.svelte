<script lang="ts">
  import {page} from '$app/state';
  import {supabase} from '$lib/supabase';
  import {onMount} from 'svelte';
  import {Terminal, Eye, EyeOff} from '@lucide/svelte';
  import {Card, FormField, Input, Button, IconButton, SkipLink} from '$lib';
  import {toastStore} from '$lib/stores/toastStore.svelte';
  import {
    turnstileWidget,
    getTurnstileResponse,
    resetTurnstile,
    turnstileSiteKey
  } from '$lib/utils/turnstile';

  let email = $state('');
  let password = $state('');
  let isSubmitting = $state(false);
  let showPassword = $state(false);
  let errors = $state({email: '', password: ''});
  let valid = $state({email: false, password: false});
  let turnstileEl = $state<HTMLDivElement | null>(null);
  let pageAuthor = $derived((page?.data as any)?.author);
  let authorName = $derived(pageAuthor?.name || '');

  onMount(async () => {
    const {data} = await supabase.auth.getSession();
    if (data.session) {
      window.location.href = '/admin';
    }
  });

  function sanitizeInput(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  function debounce<T extends unknown[]>(cb: (...args: T) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: T) => {
      clearTimeout(timer);
      timer = setTimeout(() => cb(...args), ms);
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateEmailField = debounce(() => {
    if (email.trim() === '') {
      errors.email = '';
      valid.email = false;
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
      valid.email = false;
    } else {
      errors.email = '';
      valid.email = true;
    }
  }, 500);

  const validatePasswordField = debounce(() => {
    if (password.trim() === '') {
      errors.password = '';
      valid.password = false;
    } else {
      errors.password = '';
      valid.password = true;
    }
  }, 500);

  function validate() {
    const emailErr = email.trim() === '' ? 'Email is required.' : '';
    const emailFormatErr =
      !emailErr && !emailRegex.test(email.trim()) ?
        'Please enter a valid email address.'
      : '';
    const passwordErr = password.trim() === '' ? 'Password is required.' : '';

    errors = {email: emailErr || emailFormatErr, password: passwordErr};
    if (errors.email) valid.email = false;
    if (errors.password) valid.password = false;

    return !errors.email && !errors.password;
  }

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault();
    if (!validate()) return;

    const turnstileToken = getTurnstileResponse(turnstileEl);
    if (!turnstileToken) {
      toastStore.error(
        'Please complete the verification challenge before submitting.'
      );
      return;
    }

    isSubmitting = true;

    try {
      const res = await fetch('/api/internal/admin/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          email: email.trim(),
          password: password,
          turnstileToken
        })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error?.message || 'Invalid email or password.');
      }

      const {error} = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token
      });
      if (error) throw error;

      window.location.href = '/admin';
    } catch (err: unknown) {
      console.error('Login failed:', err);
      const message =
        err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && 'message' in err ?
          String((err as {message: unknown}).message)
        : 'Invalid email or password.';
      toastStore.error(message || 'Invalid email or password.');
    } finally {
      isSubmitting = false;

      resetTurnstile(turnstileEl);
    }
  }
</script>

<svelte:head>
  <script
    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    async
    defer></script>
</svelte:head>

<SkipLink />

<main
  id="main-content"
  class="relative flex min-h-dvh flex-col items-center justify-center font-sans">
  <div class="flex w-full max-w-md items-center justify-center px-4 sm:px-6">
    <Card
      variant="solid"
      class="w-full overflow-visible p-5 sm:p-6">
      <div class="mb-4 flex flex-col items-center text-center select-none">
        <div class="flex items-center gap-2">
          <Terminal class="size-6 text-copilot select-none" />
          <h1 class="text-xl font-bold text-text-primary">Console</h1>
        </div>
        <p class="mt-1 text-xs text-text-secondary">
          Sign in to manage your blog posts
        </p>
      </div>

      <form
        novalidate
        onsubmit={handleLogin}
        class="flex w-full flex-col gap-2.5">
        <FormField
          id="login-email"
          label="Email"
          required
          hideAsterisk
          error={errors.email}
          valid={valid.email}>
          <Input
            type="text"
            id="login-email"
            placeholder="Enter your email"
            autocomplete="username"
            bind:value={email}
            error={!!errors.email}
            valid={valid.email}
            oninput={() => {
              errors.email = '';
              valid.email = false;
              validateEmailField();
            }}
            aria-required="true"
            aria-invalid={!!errors.email} />
        </FormField>

        <FormField
          id="login-pass"
          label="Password"
          required
          hideAsterisk
          error={errors.password}
          valid={valid.password}>
          <Input
            type={showPassword ? 'text' : 'password'}
            id="login-pass"
            placeholder="••••••••"
            autocomplete="current-password"
            bind:value={password}
            error={!!errors.password}
            valid={valid.password}
            oninput={() => {
              errors.password = '';
              valid.password = false;
              validatePasswordField();
            }}
            aria-required="true"
            aria-invalid={!!errors.password}>
            {#snippet trailingSlot()}
              <IconButton
                ariaLabel={showPassword ? 'Hide password' : 'Show password'}
                variant="ghost"
                size="md"
                onclick={() => (showPassword = !showPassword)}>
                {#if showPassword}
                  <EyeOff class="size-4" />
                {:else}
                  <Eye class="size-4" />
                {/if}
              </IconButton>
            {/snippet}
          </Input>
        </FormField>

        <div class="flex w-full items-center justify-center py-0.5">
          <div
            bind:this={turnstileEl}
            class="min-h-16.25 w-full [&_iframe]:border-0!"
            data-sitekey={turnstileSiteKey}
            data-action="turnstile-spin-v2"
            use:turnstileWidget={{sitekey: turnstileSiteKey, size: 'flexible'}}>
          </div>
        </div>

        <Button
          htmlType="submit"
          type="primary"
          size="lg"
          isLoading={isSubmitting}
          class="mt-2 w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Card>
  </div>

  <footer
    class="absolute inset-x-0 bottom-0 w-full px-6 py-6 text-center font-sans text-xs text-text-muted select-none">
    <p>
      &copy; {new Date().getFullYear()}{authorName ? ` ${authorName}` : ''}. All
      rights reserved.
    </p>
  </footer>
</main>
