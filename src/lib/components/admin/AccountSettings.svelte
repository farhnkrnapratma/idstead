<script lang="ts">
  import {onMount} from 'svelte';
  import {
    KeyRound,
    LogOut,
    ShieldCheck,
    Smartphone,
    Trash
  } from '@lucide/svelte';
  import {supabase} from '$lib/supabase';
  import {
    Badge,
    Button,
    ConfirmationDialog,
    EmptyState,
    FieldMessage,
    FormField,
    Input,
    LoadingState,
    toastStore
  } from '$lib';
  import FormSection from '$lib/layout/FormSection.svelte';
  import ActivityTimestamp from './ActivityTimestamp.svelte';
  import DisplaySettings from './DisplaySettings.svelte';
  import type {Factor, PasskeyListItem} from '@supabase/supabase-js';

  let loading = $state(true);
  let factors = $state<Factor[]>([]);
  let lastSignInAt = $state<string | null>(null);

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let passwordError = $state('');
  let savingPassword = $state(false);

  let enrolling = $state(false);
  let enrollment = $state<{id: string; qr: string; secret: string} | null>(
    null
  );
  let totpCode = $state('');
  let totpError = $state('');
  let verifying = $state(false);

  let passkeys = $state<PasskeyListItem[]>([]);
  let passkeyBusy = $state(false);
  let removing = $state<Factor | null>(null);
  let removingPasskey = $state<PasskeyListItem | null>(null);
  let signingOutEverywhere = $state(false);
  let showSignOutDialog = $state(false);

  const totpFactors = $derived(factors.filter(f => f.factor_type === 'totp'));
  const webauthnSupported =
    typeof window !== 'undefined' && Boolean(window.PublicKeyCredential);

  async function refresh() {
    const [{data: factorData}, {data: userData}] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.getUser()
    ]);
    factors = factorData?.all ?? [];
    lastSignInAt = userData?.user?.last_sign_in_at ?? null;
    try {
      const {data: passkeyData} = await supabase.auth.passkey.list();
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

    if (newPassword.length < 20) {
      passwordError = 'Use at least 20 characters.';
      return;
    }
    if (newPassword !== confirmPassword) {
      passwordError = 'The two new passwords do not match.';
      return;
    }
    if (!currentPassword) {
      passwordError = 'Enter your current password.';
      return;
    }

    savingPassword = true;
    try {
      const {error} = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword
      });
      if (error) throw error;
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      toastStore.success('Password updated. A confirmation email was sent.');
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
      const {data, error} = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`
      });
      if (error) throw error;
      enrollment = {
        id: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret
      };
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
      const {error} = await supabase.auth.mfa.challengeAndVerify({
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
    await supabase.auth.mfa.unenroll({factorId: id});
    await refresh();
  }

  async function addPasskey() {
    if (passkeyBusy) return;
    passkeyBusy = true;
    try {
      const {error} = await supabase.auth.registerPasskey();
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
      const {error} = await supabase.auth.passkey.delete({
        passkeyId: target.id
      });
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
      const {error} = await supabase.auth.mfa.unenroll({factorId: factor.id});
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
      const {error} = await supabase.auth.signOut({scope: 'global'});
      if (error) throw error;
      window.location.href = '/admin/login';
    } catch (error) {
      toastStore.error(message(error, 'Could not sign out everywhere.'));
      signingOutEverywhere = false;
      showSignOutDialog = false;
    }
  }
</script>

<div class="flex min-w-0 flex-col gap-4">
  <div>
    <h1 class="text-2xl font-bold text-text-primary">Account</h1>
    <p class="mt-1 text-sm text-text-secondary">
      Display preferences, password, sessions, and sign-in methods for this
      admin account.
    </p>
  </div>

  <DisplaySettings />

  {#if loading}
    <LoadingState label="Loading account…" />
  {:else}
    <FormSection
      title="Password"
      description="Changing it signs out nothing else on its own — use Sign out everywhere below for that."
      onsubmit={changePassword}>
      <div class="grid gap-3 sm:grid-cols-3">
        <FormField
          id="current-password"
          label="Current password">
          <Input
            id="current-password"
            type="password"
            autocomplete="current-password"
            bind:value={currentPassword}
            disabled={savingPassword} />
        </FormField>
        <FormField
          id="new-password"
          label="New password"
          hint="At least 20 characters.">
          <Input
            id="new-password"
            type="password"
            autocomplete="new-password"
            bind:value={newPassword}
            disabled={savingPassword} />
        </FormField>
        <FormField
          id="confirm-password"
          label="Confirm new password">
          <Input
            id="confirm-password"
            type="password"
            autocomplete="new-password"
            bind:value={confirmPassword}
            disabled={savingPassword} />
        </FormField>
      </div>
      {#if passwordError}<FieldMessage message={passwordError} />{/if}
      {#snippet actions()}
        <Button
          htmlType="submit"
          size="md"
          isLoading={savingPassword}
          disabled={savingPassword}>Update password</Button>
      {/snippet}
    </FormSection>

    <FormSection
      title="Two-factor authentication"
      description="An authenticator app code is required in addition to your password."
      bare>
      {#if enrollment}
        <div
          class="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-card p-4 sm:flex-row sm:items-start sm:gap-5">
          <img
            src={enrollment.qr}
            alt="Authenticator QR code"
            class="size-40 shrink-0 self-center rounded-md bg-white p-2 sm:self-start" />
          <div class="min-w-0 flex-1">
            <p class="text-xs text-text-secondary">
              Scan this with your authenticator app, then enter the six-digit
              code it shows.
            </p>
            <p
              class="mt-2 font-mono text-xs break-all text-text-muted select-all">
              {enrollment.secret}
            </p>
            <form
              class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start"
              onsubmit={verifyTotp}>
              <FormField
                id="totp-code"
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
              class="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-4 py-3">
              <span class="flex min-w-0 items-center gap-2">
                <Smartphone class="size-4 shrink-0 text-text-muted" />
                <span class="min-w-0">
                  <span class="block truncate text-xs font-bold"
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
          title="Two-factor authentication is off"
          description="Your password alone can sign in to this admin account.">
          {#snippet icon()}<ShieldCheck class="size-7" />{/snippet}
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

    <FormSection
      title="Passkeys"
      description="Sign in with a fingerprint, face, or security key instead of typing a password."
      bare>
      {#if !webauthnSupported}
        <FieldMessage message="This browser does not support passkeys." />
      {:else if passkeys.length}
        <ul class="flex flex-col gap-2">
          {#each passkeys as factor (factor.id)}
            <li
              class="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-4 py-3">
              <span class="flex min-w-0 items-center gap-2">
                <KeyRound class="size-4 shrink-0 text-text-muted" />
                <span class="min-w-0">
                  <span class="block truncate text-xs font-bold"
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
          title="No passkeys yet"
          description="Add one from a device you trust.">
          {#snippet icon()}<KeyRound class="size-7" />{/snippet}
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

    <FormSection
      title="Sessions"
      description="Signing out everywhere revokes every other browser and device."
      bare>
      <div
        class="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span class="text-xs text-text-secondary">
          {#if lastSignInAt}
            This session signed in <ActivityTimestamp
              date={lastSignInAt}
              class="text-xs font-semibold" />.
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
  {/if}
</div>

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
