<script lang="ts">
    import { readJson } from '#app/readJson.ts';
    import { FieldValidation, requiredText, emailError } from '@idstead/domain/fieldValidation.ts';
    import { page } from '$app/state';
    import { clearLocalAdminSession, inspectAdminAuth } from '#lib/adminAuthState.ts';
    import { supabase } from '#lib/supabase.ts';
    import { onDestroy, onMount } from 'svelte';
    import { ShieldUser, ArrowLeft, Eye, EyeOff, FingerprintPattern } from '@lucide/svelte';
    import { Card, FormField, Input, Button, IconButton, SkipLink, ThemeSelect } from '@idstead/ui';
    import { getSafeRedirectUrl } from '@idstead/domain';
    import { themeStore } from '@idstead/ui/stores/themeStore.svelte.ts';
    import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';
    import { passkeyErrorMessage } from '#app/passkeyError.ts';
    import {
        turnstileWidget,
        executeTurnstile,
        resetTurnstile,
        turnstileSiteKey
    } from '#lib/utils/turnstile.ts';

    let email = $state('');
    let password = $state('');
    let isSubmitting = $state(false);
    let showPassword = $state(false);
    let errors = $state({ email: '', password: '' });
    let valid = $state({ email: false, password: false });
    let turnstileEl = $state<HTMLDivElement | null>(null);
    let pageAuthor = $derived((page?.data as any)?.author);
    let publicSiteUrl = $derived(
        typeof pageAuthor?.siteUrl === 'string' && /^https?:\/\//.test(pageAuthor.siteUrl) ?
            pageAuthor.siteUrl
        :   ''
    );

    const validation = new FieldValidation();
    onDestroy(() => validation.destroy());
    validation.register('email', {
        value: () => email,
        baseline: () => '',
        validate: emailError,
        report: result => {
            errors.email = result.error;
            valid.email = result.valid;
        }
    });
    validation.register('password', {
        value: () => password,
        baseline: () => '',
        validate: requiredText('Password'),
        report: result => {
            errors.password = result.error;
            valid.password = result.valid;
        }
    });
    function validate() {
        return validation.submit(undefined, true);
    }

    let needsMfa = $state(false);
    let mfaFactorId = $state('');
    let mfaCode = $state('');
    let mfaError = $state('');
    let verifyingMfa = $state(false);
    let mfaInputFocused = $state(false);
    const mfaDigits = Array.from({ length: 6 }, (_, index) => index);

    function completeLogin() {
        window.location.href = getSafeRedirectUrl(page.url.searchParams.get('redirectTo'));
    }

    async function startMfa() {
        const { data: factorData, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const factor = factorData?.totp?.[0];
        if (!factor) throw new Error('No verified authenticator is available.');
        mfaFactorId = factor.id;
        mfaCode = '';
        mfaError = '';
        mfaInputFocused = false;
        needsMfa = true;
    }

    async function continueAfterSignIn() {
        const auth = await inspectAdminAuth(supabase);
        if (auth.status === 'authenticated') {
            completeLogin();
            return;
        }
        if (auth.status === 'mfa-required') {
            try {
                await startMfa();
            } catch (error) {
                void clearLocalAdminSession(supabase);
                throw error;
            }
            return;
        }
        if (auth.status === 'invalid') {
            console.error('Admin session check failed:', auth.error);
            void clearLocalAdminSession(supabase);
            throw new Error('Your sign-in session could not be verified. Please try again.');
        }
        if (auth.status === 'unauthorized') {
            void clearLocalAdminSession(supabase);
            throw new Error('This account is not authorized to access the admin portal.');
        }
        throw new Error('The sign-in session was not created. Please try again.');
    }

    onMount(() => {
        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange(event => {
            if (event === 'SIGNED_OUT') {
                needsMfa = false;
                mfaCode = '';
                mfaError = '';
                verifyingMfa = false;
                mfaInputFocused = false;
            }
        });

        return () => subscription.unsubscribe();
    });

    async function submitMfaCode(event: SubmitEvent) {
        event.preventDefault();
        if (verifyingMfa || passkeyBusy) return;
        mfaError = '';
        verifyingMfa = true;
        try {
            const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorId: mfaFactorId,
                code: mfaCode.trim()
            });
            if (error) throw error;
            completeLogin();
        } catch (err) {
            let auth: Awaited<ReturnType<typeof inspectAdminAuth>>;
            try {
                auth = await inspectAdminAuth(supabase);
            } catch (error) {
                console.error('Admin session check failed:', error);
                auth = { status: 'invalid', error };
            }
            if (auth.status === 'mfa-required') {
                mfaError = err instanceof Error ? err.message : 'That code was not accepted.';
            } else {
                if (auth.status === 'invalid')
                    console.error('Admin session check failed:', auth.error);
                void clearLocalAdminSession(supabase);
                needsMfa = false;
                mfaCode = '';
                mfaError = '';
                toastStore.error('Your sign-in session expired. Please sign in again.');
            }
        } finally {
            verifyingMfa = false;
        }
    }

    function updateMfaCode(event: Event) {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) return;
        const code = input.value.replace(/[^0-9]/g, '').slice(0, 6);
        input.value = code;
        mfaCode = code;
        mfaError = '';
    }

    let passkeyBusy = $state(false);

    async function signInWithPasskey() {
        if (passkeyBusy) return;
        passkeyBusy = true;
        try {
            const captchaToken = await executeTurnstile(turnstileEl);
            if (!captchaToken) {
                toastStore.error('Please complete the verification challenge before signing in.');
                return;
            }
            const { error } = await supabase.auth.signInWithPasskey({ options: { captchaToken } });
            if (error) throw error;
            await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
            await continueAfterSignIn();
        } catch (err) {
            toastStore.error(passkeyErrorMessage(err, 'Passkey sign-in failed.'));
        } finally {
            passkeyBusy = false;
            resetTurnstile(turnstileEl);
        }
    }

    function cancelMfa() {
        needsMfa = false;
        mfaCode = '';
        mfaError = '';
        mfaInputFocused = false;
        void clearLocalAdminSession(supabase);
    }
    async function handleLogin(e: SubmitEvent) {
        e.preventDefault();
        if (!(await validate())) return;

        const captchaToken = await executeTurnstile(turnstileEl);
        if (!captchaToken) {
            resetTurnstile(turnstileEl);
            toastStore.error('Please complete the verification challenge before submitting.');
            return;
        }

        isSubmitting = true;

        try {
            const res = await fetch('/api/internal/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password: password, captchaToken })
            });

            const result = await readJson(res);

            if (!res.ok) {
                throw new Error(result.error?.message || 'Invalid email or password.');
            }

            await continueAfterSignIn();
        } catch (err: unknown) {
            console.error('Login failed:', err);
            const message =
                err instanceof Error ? err.message
                : typeof err === 'object' && err !== null && 'message' in err ?
                    String((err as { message: unknown }).message)
                :   'Invalid email or password.';
            toastStore.error(message || 'Invalid email or password.');
        } finally {
            isSubmitting = false;

            resetTurnstile(turnstileEl);
        }
    }
</script>

<svelte:head>
    <title>Admin Portal</title>
    <script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        async
        defer></script>
</svelte:head>

<SkipLink />

<header
    class="fixed inset-x-0 top-0 z-40 flex h-14 w-full items-center justify-between px-4 sm:px-6">
    {#if publicSiteUrl}
        <Button
            href={publicSiteUrl}
            type="secondary"
            size="sm">
            {#snippet leading()}
                <ArrowLeft class="size-4" />
            {/snippet}
            Home
        </Button>
    {:else}
        <span></span>
    {/if}
    <ThemeSelect
        theme={themeStore.current}
        onThemeChange={themeStore.apply} />
</header>

{#snippet authMethodDivider()}
    <div class="my-1 flex items-center gap-3 text-xs text-fg-muted">
        <span class="h-px flex-1 bg-line-subtle"></span>
        <span>or</span>
        <span class="h-px flex-1 bg-line-subtle"></span>
    </div>
{/snippet}

{#snippet turnstileField()}
    <div
        bind:this={turnstileEl}
        class="turnstile-widget select-none"
        use:turnstileWidget={{
            sitekey: turnstileSiteKey,
            size: 'flexible',
            action: 'admin-login',
            theme: 'auto',
            appearance: 'interaction-only',
            execution: 'render'
        }}>
    </div>
{/snippet}

<main
    id="main"
    class="relative flex min-h-dvh flex-col items-center justify-center font-sans">
    <div class="flex w-full max-w-sm items-center justify-center px-4">
        <Card
            variant="solid"
            class="w-full overflow-visible p-5 sm:p-6">
            <div class="mb-5 flex flex-col items-center text-center select-none">
                <div
                    class="mb-3 flex size-10 items-center justify-center rounded-full bg-accent-subtle text-accent">
                    <ShieldUser class="size-5" />
                </div>
                <h1 class="text-xl font-bold text-fg">Admin Portal</h1>
                <p class="mt-1 text-xs text-fg-secondary">
                    {needsMfa ? 'Two-step verification' : 'Sign in to access your admin dashboard.'}
                </p>
            </div>

            {#if needsMfa}
                <form
                    novalidate
                    onsubmit={submitMfaCode}
                    class="flex w-full flex-col gap-2.5">
                    <p class="text-xs text-fg-secondary">
                        Enter the 6-digit code from your authenticator app.
                    </p>
                    <FormField
                        id="login-mfa"
                        label="Verification code"
                        error={mfaError}>
                        <div class="group relative">
                            <Input
                                id="login-mfa"
                                type="text"
                                inputmode="numeric"
                                autocomplete="one-time-code"
                                maxlength={6}
                                value={mfaCode}
                                oninput={updateMfaCode}
                                onfocus={() => {
                                    mfaInputFocused = true;
                                    mfaError = '';
                                }}
                                onblur={() => (mfaInputFocused = false)}
                                aria-label="Verification code"
                                aria-invalid={Boolean(mfaError)}
                                aria-describedby={mfaError ? 'login-mfa-error' : undefined}
                                class="h-12 border-0! bg-transparent px-0 text-transparent caret-transparent shadow-none ring-0 ring-offset-0 outline-none selection:text-transparent focus:border-0! focus:bg-transparent focus:shadow-none! focus:ring-0! focus:ring-transparent! focus:outline-none! focus-visible:border-0! focus-visible:shadow-none! focus-visible:ring-0! focus-visible:ring-transparent! focus-visible:outline-none!"
                                error={Boolean(mfaError)}
                                disabled={verifyingMfa || passkeyBusy} />
                            <div
                                class="pointer-events-none absolute inset-0 flex gap-2"
                                aria-hidden="true">
                                {#each mfaDigits as index (index)}
                                    <span
                                        class={`flex h-full min-w-0 flex-1 items-center justify-center rounded-md border bg-surface/85 text-xl font-medium text-fg tabular-nums shadow-2xs transition-colors dark:bg-surface/70 ${
                                            mfaError ? 'border-danger ring-1 ring-danger/20'
                                            : (
                                                mfaInputFocused
                                                && index === Math.min(mfaCode.length, 5)
                                            ) ?
                                                'border-accent ring-2 ring-accent/20'
                                            :   'border-line-subtle/50 dark:border-fg/10'
                                        }`}>{mfaCode[index] ?? ''}</span>
                                {/each}
                            </div>
                        </div>
                    </FormField>
                    <Button
                        htmlType="submit"
                        size="md"
                        fullWidth
                        isLoading={verifyingMfa}
                        disabled={verifyingMfa || passkeyBusy}>Verify and continue</Button>
                    {@render turnstileField()}
                    {@render authMethodDivider()}
                    <Button
                        type="tertiary"
                        size="md"
                        fullWidth
                        onclick={signInWithPasskey}
                        isLoading={passkeyBusy}
                        disabled={verifyingMfa || passkeyBusy}>
                        {#snippet leading()}<FingerprintPattern class="size-4" />{/snippet}
                        Passkey
                    </Button>
                    <Button
                        type="ghost"
                        size="md"
                        fullWidth
                        onclick={cancelMfa}
                        disabled={verifyingMfa || passkeyBusy}>Use a different account</Button>
                </form>
            {:else}
                <form
                    novalidate
                    onsubmit={handleLogin}
                    class="flex w-full flex-col gap-2.5">
                    <FormField
                        id="login-email"
                        label="Email"
                        variant="floating"
                        required
                        hideAsterisk
                        error={errors.email}
                        valid={valid.email}>
                        <Input
                            type="text"
                            id="login-email"
                            autocomplete="username"
                            autofocus
                            bind:value={email}
                            error={!!errors.email}
                            valid={valid.email}
                            oninput={() => {
                                errors.email = '';
                                valid.email = false;
                                queueMicrotask(() => validation.input('email'));
                            }}
                            aria-required="true"
                            aria-invalid={!!errors.email}
                            onblur={() => {
                                void validation.check('email');
                            }} />
                    </FormField>

                    <FormField
                        id="login-pass"
                        label="Password"
                        variant="floating"
                        required
                        hideAsterisk
                        error={errors.password}
                        valid={valid.password}>
                        <Input
                            type={showPassword ? 'text' : 'password'}
                            id="login-pass"
                            autocomplete="current-password"
                            bind:value={password}
                            error={!!errors.password}
                            valid={valid.password}
                            oninput={() => {
                                errors.password = '';
                                valid.password = false;
                                queueMicrotask(() => validation.input('password'));
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
                                        <EyeOff
                                            class="size-4"
                                            onblur={() => {
                                                void validation.check('password');
                                            }} />
                                    {:else}
                                        <Eye class="size-4" />
                                    {/if}
                                </IconButton>
                            {/snippet}
                        </Input>
                    </FormField>

                    {@render turnstileField()}

                    <Button
                        htmlType="submit"
                        type="primary"
                        size="md"
                        isLoading={isSubmitting}
                        class="mt-2 w-full">
                        {isSubmitting ? 'Signing in…' : 'Sign in'}
                    </Button>

                    {@render authMethodDivider()}
                    <Button
                        type="tertiary"
                        size="md"
                        class="w-full"
                        onclick={signInWithPasskey}
                        isLoading={passkeyBusy}
                        disabled={isSubmitting || passkeyBusy}>
                        {#snippet leading()}<FingerprintPattern class="size-4" />{/snippet}
                        Passkey
                    </Button>
                </form>
            {/if}
        </Card>
    </div>
</main>
