<script lang="ts">
    import { onMount, type Snippet } from 'svelte';
    import { adminUrl, navigateAdmin } from '../../adminNavigation.ts';
    import { resolveAdminSettings, type AdminSettingsSection } from '../../adminUrl.ts';
    import {
        Database,
        Eye,
        EyeOff,
        KeyRound,
        LogOut,
        ShieldCheck,
        Smartphone,
        Trash
    } from '@lucide/svelte';
    import { supabase } from '#lib/supabase.ts';
    import { passwordPolicyError } from '@idstead/domain/passwordPolicy.ts';
    import PasswordGenerator from './PasswordGenerator.svelte';
    import {
        Badge,
        Button,
        Card,
        ConfirmationDialog,
        EmptyState,
        FieldMessage,
        FormField,
        IconButton,
        Input,
        LoadingState,
        toastStore
    } from '@idstead/ui';
    import FormSection from '@idstead/ui/layout/FormSection.svelte';
    import Section from '@idstead/ui/layout/Section.svelte';
    import ActivityTimestamp from './ActivityTimestamp.svelte';
    import DisplaySettings from './DisplaySettings.svelte';
    import type { Factor, PasskeyListItem } from '@supabase/supabase-js';

    let { children }: { children?: Snippet } = $props();

    let loading = $state(true);
    let factors = $state<Factor[]>([]);
    let lastSignInAt = $state<string | null>(null);

    let currentPassword = $state('');
    let newPassword = $state('');
    let confirmPassword = $state('');
    let passwordError = $state('');
    let savingPassword = $state(false);
    let showCurrentPassword = $state(false);
    let showNewPassword = $state(false);

    let currentPasswordTouched = $state(false);
    let newPasswordTouched = $state(false);
    let confirmPasswordTouched = $state(false);
    const newPasswordError = $derived(passwordPolicyError(newPassword));
    const visibleNewPasswordError = $derived(newPasswordTouched ? newPasswordError : '');
    const visibleConfirmPasswordError = $derived(
        confirmPasswordTouched && newPassword !== confirmPassword ?
            'The two new passwords do not match.'
        :   ''
    );
    const visibleCurrentPasswordError = $derived(
        currentPasswordTouched && !currentPassword ? 'Enter your current password.' : ''
    );

    function setCurrentPassword(value: string | number) {
        currentPassword = String(value);
        if (currentPassword) currentPasswordTouched = false;
        passwordError = '';
    }

    function setNewPassword(value: string | number) {
        newPassword = String(value);
        if (!newPassword || !passwordPolicyError(newPassword)) newPasswordTouched = false;
        if (!newPassword) {
            confirmPassword = '';
            confirmPasswordTouched = false;
        }
        if (newPassword === confirmPassword) confirmPasswordTouched = false;
        passwordError = '';
    }

    function setConfirmPassword(value: string | number) {
        confirmPassword = String(value);
        if (!confirmPassword || confirmPassword === newPassword) confirmPasswordTouched = false;
        passwordError = '';
    }

    function useGeneratedPassword(password: string) {
        setNewPassword(password);
        confirmPassword = password;
        confirmPasswordTouched = false;
        showNewPassword = false;
    }

    let enrolling = $state(false);
    let enrollment = $state<{ id: string; qr: string; secret: string } | null>(null);
    let totpCode = $state('');
    let totpError = $state('');
    let verifying = $state(false);

    let passkeys = $state<PasskeyListItem[]>([]);
    let passkeyBusy = $state(false);
    let removing = $state<Factor | null>(null);
    let removingPasskey = $state<PasskeyListItem | null>(null);
    let signingOutEverywhere = $state(false);
    let showSignOutDialog = $state(false);
    const activeTab = $derived(resolveAdminSettings(adminUrl().searchParams.get('settings')));

    const tabs = [
        { id: 'appearance' as const, label: 'Appearance', icon: Eye },
        { id: 'security' as const, label: 'Account & Security', icon: ShieldCheck },
        { id: 'data' as const, label: 'Data Management', icon: Database }
    ];

    function selectSection(event: MouseEvent, section: AdminSettingsSection) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        event.preventDefault();
        if (activeTab === section) return;
        const url = adminUrl();
        url.searchParams.set('settings', section);
        navigateAdmin(url);
    }

    const totpFactors = $derived(factors.filter(f => f.factor_type === 'totp'));
    const webauthnSupported = typeof window !== 'undefined' && Boolean(window.PublicKeyCredential);

    async function refresh() {
        const [{ data: factorData }, { data: userData }] = await Promise.all([
            supabase.auth.mfa.listFactors(),
            supabase.auth.getUser()
        ]);
        factors = factorData?.all ?? [];
        lastSignInAt = userData?.user?.last_sign_in_at ?? null;
        try {
            const { data: passkeyData } = await supabase.auth.passkey.list();
            passkeys = passkeyData ?? [];
        } catch {
            passkeys = [];
        }
        loading = false;
    }

    onMount(refresh);

    function message(error: unknown, fallback: string) {
        return error instanceof Error ? error.message : fallback;
    }

    async function changePassword(event: SubmitEvent) {
        event.preventDefault();
        if (savingPassword) return;
        passwordError = '';

        currentPasswordTouched = !currentPassword;
        newPasswordTouched = Boolean(newPasswordError);
        confirmPasswordTouched = newPassword !== confirmPassword;
        if (newPasswordError || newPassword !== confirmPassword || !currentPassword) {
            const id =
                !currentPassword ? 'current-password'
                : newPasswordError ? 'new-password'
                : 'confirm-password';
            document.getElementById(id)?.focus();
            return;
        }

        savingPassword = true;
        try {
            const {
                data: { session }
            } = await supabase.auth.getSession();
            if (!session) throw new Error('Please sign in again.');
            const response = await fetch('/api/internal/admin/password', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: newPassword, currentPassword })
            });
            const result = await response.json();
            if (!response.ok)
                throw new Error(
                    result.error?.message || result.message || 'Password could not be updated.'
                );
            currentPassword = '';
            setNewPassword('');
            currentPasswordTouched = false;
            newPasswordTouched = false;
            confirmPasswordTouched = false;
            showCurrentPassword = false;
            showNewPassword = false;
            toastStore.success('Password updated.');
        } catch (error) {
            passwordError = message(error, 'Password could not be updated.');
        } finally {
            savingPassword = false;
        }
    }

    async function startTotpEnrollment() {
        if (enrolling) return;
        enrolling = true;
        totpError = '';
        try {
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`
            });
            if (error) throw error;
            enrollment = { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
        } catch (error) {
            toastStore.error(message(error, 'Could not start enrollment.'));
        } finally {
            enrolling = false;
        }
    }

    async function verifyTotp(event: SubmitEvent) {
        event.preventDefault();
        if (!enrollment || verifying) return;
        totpError = '';
        verifying = true;
        try {
            const { error } = await supabase.auth.mfa.challengeAndVerify({
                factorId: enrollment.id,
                code: totpCode.trim()
            });
            if (error) throw error;
            enrollment = null;
            totpCode = '';
            await refresh();
            toastStore.success('Two-factor authentication is on.');
        } catch (error) {
            totpError = message(error, 'That code was not accepted.');
        } finally {
            verifying = false;
        }
    }

    async function cancelEnrollment() {
        if (!enrollment) return;
        const id = enrollment.id;
        enrollment = null;
        totpCode = '';
        totpError = '';
        await supabase.auth.mfa.unenroll({ factorId: id });
        await refresh();
    }

    async function addPasskey() {
        if (passkeyBusy) return;
        passkeyBusy = true;
        try {
            const { error } = await supabase.auth.registerPasskey();
            if (error) throw error;
            await refresh();
            toastStore.success('Passkey added.');
        } catch (error) {
            toastStore.error(message(error, 'Passkey could not be added.'));
        } finally {
            passkeyBusy = false;
        }
    }

    async function removePasskey() {
        if (!removingPasskey) return;
        const target = removingPasskey;
        try {
            const { error } = await supabase.auth.passkey.delete({ passkeyId: target.id });
            if (error) throw error;
            await refresh();
            toastStore.success('Passkey removed.');
        } catch (error) {
            toastStore.error(message(error, 'Could not remove the passkey.'));
        } finally {
            removingPasskey = null;
        }
    }

    async function removeFactor() {
        if (!removing) return;
        const factor = removing;
        try {
            const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
            if (error) throw error;
            await refresh();
            toastStore.success('Removed.');
        } catch (error) {
            toastStore.error(message(error, 'Could not remove it.'));
        } finally {
            removing = null;
        }
    }

    async function signOutEverywhere() {
        if (signingOutEverywhere) return;
        signingOutEverywhere = true;
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (token)
                await fetch('/api/internal/admin/logout', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(() => {});
            const { error } = await supabase.auth.signOut({ scope: 'global' });
            if (error) throw error;
            window.location.href = '/login';
        } catch (error) {
            toastStore.error(message(error, 'Could not sign out everywhere.'));
            signingOutEverywhere = false;
            showSignOutDialog = false;
        }
    }
</script>

<Section
    spacing="none"
    class="flex min-w-0 flex-col gap-4">
    <div>
        <h1 class="type-page-title">Settings</h1>
        <p class="mt-1 type-body text-fg-secondary">
            Manage appearance, account security, and site data.
        </p>
    </div>

    <nav
        aria-label="Settings sections"
        data-sveltekit-preload-data="off"
        class="flex flex-wrap gap-1 border-b border-line-subtle">
        {#each tabs as tab (tab.id)}
            <a
                href={`/?tab=account&settings=${tab.id}`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                class={[
                    'flex min-h-11 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring',
                    activeTab === tab.id ?
                        'border-accent text-fg-accent'
                    :   'border-transparent text-fg-secondary hover:text-fg'
                ]}
                onclick={event => selectSection(event, tab.id)}>
                <tab.icon class="size-4" />
                {tab.label}
            </a>
        {/each}
    </nav>

    {#if activeTab === 'appearance'}
        <DisplaySettings />
    {/if}

    {#if activeTab === 'security' && loading}
        <LoadingState label="Loading account…" />
    {:else if activeTab === 'security'}
        <Card
            variant="bordered"
            class="border-line-subtle! bg-surface!">
            <FormSection
                title="Password"
                titleClass="type-card-title"
                description="Change your account password. Other sessions will stay signed in."
                class="w-full max-w-lg"
                onsubmit={changePassword}
                bare>
                <div class="flex flex-col gap-3">
                    <div class="flex flex-col gap-4">
                        <FormField
                            id="current-password"
                            hideFeedbackSlot
                            label="Current password"
                            error={visibleCurrentPasswordError}>
                            <Input
                                id="current-password"
                                type={showCurrentPassword ? 'text' : 'password'}
                                autocomplete="current-password"
                                autocapitalize="none"
                                spellcheck={false}
                                bind:value={() => currentPassword, setCurrentPassword}
                                disabled={savingPassword}
                                error={!!visibleCurrentPasswordError}
                                aria-invalid={!!visibleCurrentPasswordError}
                                aria-describedby={visibleCurrentPasswordError ?
                                    'current-password-error'
                                :   undefined}>
                                {#snippet trailingSlot()}
                                    <IconButton
                                        variant="ghost"
                                        size="xs"
                                        ariaLabel={showCurrentPassword ? 'Hide current password' : (
                                            'Show current password'
                                        )}
                                        aria-controls="current-password"
                                        aria-pressed={showCurrentPassword}
                                        disabled={savingPassword}
                                        onclick={() =>
                                            (showCurrentPassword = !showCurrentPassword)}>
                                        {#if showCurrentPassword}
                                            <EyeOff class="size-3.5" />
                                        {:else}
                                            <Eye class="size-3.5" />
                                        {/if}
                                    </IconButton>
                                {/snippet}
                            </Input>
                        </FormField>
                        <FormField
                            id="new-password"
                            hideFeedbackSlot
                            label="New password"
                            error={visibleNewPasswordError}>
                            <Input
                                id="new-password"
                                type={showNewPassword ? 'text' : 'password'}
                                autocomplete="new-password"
                                autocapitalize="none"
                                spellcheck={false}
                                bind:value={() => newPassword, setNewPassword}
                                onblur={() =>
                                    (newPasswordTouched = Boolean(newPassword && newPasswordError))}
                                disabled={savingPassword}
                                error={!!visibleNewPasswordError}
                                aria-invalid={!!visibleNewPasswordError}
                                aria-describedby={visibleNewPasswordError ? 'new-password-error' : (
                                    undefined
                                )}>
                                {#snippet trailingSlot()}
                                    <IconButton
                                        variant="ghost"
                                        size="xs"
                                        ariaLabel={showNewPassword ? 'Hide new password' : (
                                            'Show new password'
                                        )}
                                        aria-controls="new-password"
                                        aria-pressed={showNewPassword}
                                        disabled={savingPassword}
                                        onclick={() => (showNewPassword = !showNewPassword)}>
                                        {#if showNewPassword}
                                            <EyeOff class="size-3.5" />
                                        {:else}
                                            <Eye class="size-3.5" />
                                        {/if}
                                    </IconButton>
                                {/snippet}
                            </Input>
                        </FormField>
                        <div class="-mt-2 flex">
                            <PasswordGenerator
                                disabled={savingPassword}
                                onuse={useGeneratedPassword} />
                        </div>
                        <FormField
                            id="confirm-password"
                            hideFeedbackSlot
                            label="Confirm new password"
                            error={visibleConfirmPasswordError}>
                            <Input
                                id="confirm-password"
                                type="password"
                                autocomplete="new-password"
                                autocapitalize="none"
                                spellcheck={false}
                                bind:value={() => confirmPassword, setConfirmPassword}
                                onblur={() =>
                                    (confirmPasswordTouched = Boolean(
                                        confirmPassword && confirmPassword !== newPassword
                                    ))}
                                disabled={savingPassword}
                                error={!!visibleConfirmPasswordError}
                                aria-invalid={!!visibleConfirmPasswordError}
                                aria-describedby={visibleConfirmPasswordError ?
                                    'confirm-password-error'
                                :   undefined} />
                        </FormField>
                    </div>

                    {#if passwordError}<FieldMessage message={passwordError} />{/if}
                </div>
                {#snippet actions()}
                    <Button
                        htmlType="submit"
                        size="md"
                        isLoading={savingPassword}
                        disabled={savingPassword}>Update password</Button>
                {/snippet}
            </FormSection>
        </Card>

        <Card
            variant="bordered"
            class="border-line-subtle! bg-surface!">
            <FormSection
                title="Two-factor authentication"
                titleClass="type-card-title"
                description="Require an authenticator app code in addition to your password."
                bare>
                {#if enrollment}
                    <div
                        class="flex flex-col gap-3 rounded-md border border-line-subtle bg-surface p-4 sm:flex-row sm:items-start sm:gap-5">
                        <img
                            src={enrollment.qr}
                            alt="Authenticator QR code"
                            class="size-40 shrink-0 self-center rounded-md bg-white p-2 sm:self-start" />
                        <div class="min-w-0 flex-1">
                            <p class="text-xs text-fg-secondary">
                                Scan this with your authenticator app, then enter the six-digit code
                                it shows.
                            </p>
                            <p class="mt-2 font-mono text-xs break-all text-fg-muted select-all">
                                {enrollment.secret}
                            </p>
                            <form
                                class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start"
                                onsubmit={verifyTotp}>
                                <FormField
                                    id="totp-code"
                                    label="Verification code"
                                    class="min-w-0 flex-1">
                                    <Input
                                        id="totp-code"
                                        inputmode="numeric"
                                        autocomplete="one-time-code"
                                        maxlength={6}
                                        placeholder="123456"
                                        bind:value={totpCode}
                                        disabled={verifying} />
                                </FormField>
                                <Button
                                    htmlType="submit"
                                    size="md"
                                    isLoading={verifying}
                                    disabled={verifying}>Verify</Button>
                                <Button
                                    type="ghost"
                                    size="md"
                                    onclick={cancelEnrollment}
                                    disabled={verifying}>Cancel</Button>
                            </form>
                            {#if totpError}<FieldMessage message={totpError} />{/if}
                        </div>
                    </div>
                {:else if totpFactors.length}
                    <ul class="flex flex-col gap-2">
                        {#each totpFactors as factor (factor.id)}
                            <li
                                class="flex items-center justify-between gap-3 rounded-md border border-line-subtle bg-surface px-4 py-3">
                                <span class="flex min-w-0 items-center gap-2">
                                    <Smartphone class="size-4 shrink-0 text-fg-muted" />
                                    <span class="min-w-0">
                                        <span class="block truncate text-sm font-bold"
                                            >{factor.friendly_name || 'Authenticator app'}</span>
                                        <ActivityTimestamp
                                            date={factor.created_at}
                                            prefix="Added" />
                                    </span>
                                </span>
                                <span class="flex shrink-0 items-center gap-2">
                                    <Badge variant="success">Verified</Badge>
                                    <Button
                                        type="ghost"
                                        size="xs"
                                        aria-label="Remove authenticator"
                                        onclick={() => (removing = factor)}>
                                        {#snippet leading()}<Trash class="size-3" />{/snippet}
                                        Remove
                                    </Button>
                                </span>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <EmptyState
                        icon={ShieldCheck}
                        title="Two-factor authentication is off"
                        description="Your password alone can sign in to this admin account.">
                        {#snippet actions()}
                            <Button
                                size="sm"
                                isLoading={enrolling}
                                disabled={enrolling}
                                onclick={startTotpEnrollment}>Set up authenticator app</Button>
                        {/snippet}
                    </EmptyState>
                {/if}
            </FormSection>
        </Card>

        <Card
            variant="bordered"
            class="border-line-subtle! bg-surface!">
            <FormSection
                title="Passkeys"
                titleClass="type-card-title"
                description="Sign in with a fingerprint, face, or security key instead of typing a password."
                bare>
                {#if !webauthnSupported}
                    <FieldMessage message="This browser does not support passkeys." />
                {:else if passkeys.length}
                    <ul class="flex flex-col gap-2">
                        {#each passkeys as factor (factor.id)}
                            <li
                                class="flex items-center justify-between gap-3 rounded-md border border-line-subtle bg-surface px-4 py-3">
                                <span class="flex min-w-0 items-center gap-2">
                                    <KeyRound class="size-4 shrink-0 text-fg-muted" />
                                    <span class="min-w-0">
                                        <span class="block truncate text-sm font-bold"
                                            >{factor.friendly_name || 'Passkey'}</span>
                                        <ActivityTimestamp
                                            date={factor.created_at}
                                            prefix="Added" />
                                    </span>
                                </span>
                                <Button
                                    type="ghost"
                                    size="xs"
                                    aria-label="Remove passkey"
                                    onclick={() => (removingPasskey = factor)}>
                                    {#snippet leading()}<Trash class="size-3" />{/snippet}
                                    Remove
                                </Button>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <EmptyState
                        icon={KeyRound}
                        title="No passkeys yet"
                        description="Add one from a device you trust.">
                    </EmptyState>
                {/if}
                {#if webauthnSupported}
                    <div class="mt-3 flex justify-end">
                        <Button
                            type="secondary"
                            size="sm"
                            isLoading={passkeyBusy}
                            disabled={passkeyBusy}
                            onclick={addPasskey}>Add a passkey</Button>
                    </div>
                {/if}
            </FormSection>
        </Card>

        <Card
            variant="bordered"
            class="border-line-subtle! bg-surface!">
            <FormSection
                title="Sessions"
                titleClass="type-card-title"
                description="Signing out everywhere revokes every other browser and device."
                bare>
                <div
                    class="flex flex-col gap-3 rounded-md border border-line-subtle bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span class="text-xs text-fg-secondary">
                        {#if lastSignInAt}
                            This session signed in <ActivityTimestamp
                                date={lastSignInAt}
                                class="font-semibold" />.
                        {:else}
                            Sign-in time is unavailable for this session.
                        {/if}
                    </span>
                    <Button
                        type="danger"
                        tone="critical"
                        size="sm"
                        class="shrink-0"
                        disabled={signingOutEverywhere}
                        onclick={() => (showSignOutDialog = true)}>
                        {#snippet leading()}<LogOut class="size-3.5" />{/snippet}
                        Sign out everywhere
                    </Button>
                </div>
            </FormSection>
        </Card>
    {/if}

    {#if activeTab === 'data'}
        {@render children?.()}
    {/if}
</Section>

<ConfirmationDialog
    isOpen={removing !== null}
    title="Remove this sign-in method?"
    message="You will not be able to use it to sign in until you add it again."
    confirmLabel="Remove"
    isDestructive
    onConfirm={removeFactor}
    onCancel={() => (removing = null)} />

<ConfirmationDialog
    isOpen={removingPasskey !== null}
    title="Remove this passkey?"
    message="You will not be able to sign in with it until you add it again."
    confirmLabel="Remove"
    isDestructive
    onConfirm={removePasskey}
    onCancel={() => (removingPasskey = null)} />

<ConfirmationDialog
    isOpen={showSignOutDialog}
    title="Sign out everywhere?"
    message="Every session, including this one, will be signed out. You will need to log in again."
    confirmLabel="Sign out everywhere"
    isDestructive
    isLoading={signingOutEverywhere}
    onConfirm={signOutEverywhere}
    onCancel={() => (showSignOutDialog = false)} />
