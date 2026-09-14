<script lang="ts">
  import {onMount, untrack} from 'svelte';
  import {fade} from 'svelte/transition';
  import {ShieldCheck, X, Trash} from '@lucide/svelte';
  import {
    consentStore,
    type ConsentStatus
  } from '../stores/consentStore.svelte';
  import {focusScope} from '../utils/focusScope';
  import {buttonKey} from '$lib/shortcuts';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import Dropdown from './Dropdown.svelte';

  const CONSENT_BANNER_SCOPE = 'consent-banner';

  let tempAnalytics = $state<ConsentStatus>('denied');
  let tempAdStorage = $state<ConsentStatus>('denied');
  let tempAdUserData = $state<ConsentStatus>('denied');
  let tempAdPersonalization = $state<ConsentStatus>('denied');

  const CONSENT_OPTIONS = [
    {value: 'denied', label: 'Deny'},
    {value: 'granted', label: 'Allow'}
  ];

  onMount(() => {
    consentStore.init();
  });

  $effect(() => {
    if (consentStore.isCustomizeModalOpen) {
      untrack(() => {
        tempAnalytics = consentStore.signals.analytics_storage;
        tempAdStorage = consentStore.signals.ad_storage;
        tempAdUserData = consentStore.signals.ad_user_data;
        tempAdPersonalization = consentStore.signals.ad_personalization;
      });
    }
  });

  function openCustomize() {
    consentStore.openCustomizeModal();
  }

  function saveCustomPreferences() {
    consentStore.updateConsent({
      analytics_storage: tempAnalytics,
      ad_storage: tempAdStorage,
      ad_user_data: tempAdUserData,
      ad_personalization: tempAdPersonalization
    });
    consentStore.closeCustomizeModal();
  }

  function applyPreset(type: 'all' | 'analytics' | 'deny') {
    if (type === 'all') {
      tempAnalytics = 'granted';
      tempAdStorage = 'granted';
      tempAdUserData = 'granted';
      tempAdPersonalization = 'granted';
    } else if (type === 'analytics') {
      tempAnalytics = 'granted';
      tempAdStorage = 'denied';
      tempAdUserData = 'denied';
      tempAdPersonalization = 'denied';
    } else {
      tempAnalytics = 'denied';
      tempAdStorage = 'denied';
      tempAdUserData = 'denied';
      tempAdPersonalization = 'denied';
    }
  }

  const presetSliderValue = $derived(
    (
      tempAnalytics === 'granted'
        && tempAdStorage === 'granted'
        && tempAdUserData === 'granted'
        && tempAdPersonalization === 'granted'
    ) ?
      0
    : (
      tempAnalytics === 'denied'
      && tempAdStorage === 'denied'
      && tempAdUserData === 'denied'
      && tempAdPersonalization === 'denied'
    ) ?
      2
    : 1
  );

  const presetColor = $derived(
    presetSliderValue === 0 ? 'var(--color-danger)'
    : presetSliderValue === 1 ? 'var(--color-warning)'
    : 'var(--color-success)'
  );

  const presetLabel = $derived(
    presetSliderValue === 0 ? 'Allow all'
    : presetSliderValue === 1 ? 'Analytics only'
    : 'Deny all'
  );

  function handlePresetSlider(e: Event) {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    applyPreset(
      value === 0 ? 'all'
      : value === 1 ? 'analytics'
      : 'deny'
    );
  }
</script>

{#if consentStore.isBannerOpen}
  <aside
    transition:fade={{duration: 200}}
    use:focusScope={CONSENT_BANNER_SCOPE}
    aria-label="Cookie and privacy consent"
    class="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-xl rounded-md glass-overlay p-5 transition-all sm:right-auto sm:bottom-6 sm:left-6 sm:w-full">
    <div class="flex flex-col gap-4">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
            <ShieldCheck class="size-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-text-primary">
              Cookie and privacy preferences
            </h3>
            <p class="text-xxs text-text-muted">
              We use cookies to analyze site traffic and enhance your
              experience.
            </p>
          </div>
        </div>
        <Button
          type="ghost"
          size="xs"
          onclick={consentStore.closeBanner}
          aria-label="Dismiss banner"
          class="shrink-0 px-1">
          <X class="size-3.5" />
        </Button>
      </div>

      <p class="text-xs leading-relaxed text-text-secondary">
        Choose which data processing signals you wish to allow. You can update
        your choice at any time. See our <a
          href="/privacy"
          class="font-semibold text-accent underline hover:text-accent-hover"
          >Privacy Policy</a> for full details.
      </p>

      <div
        class="grid grid-cols-2 gap-2 pt-1 sm:flex sm:flex-wrap sm:items-center">
        <Button
          type="primary"
          size="sm"
          class="w-full sm:w-auto"
          keyboardShortcut="A"
          shortcutScope={CONSENT_BANNER_SCOPE}
          shortcutLabel="Accept all cookies"
          onclick={consentStore.acceptAll}>
          Accept all
        </Button>
        <Button
          type="secondary"
          size="sm"
          class="w-full sm:w-auto"
          keyboardShortcut="N"
          shortcutScope={CONSENT_BANNER_SCOPE}
          shortcutLabel="Analytics cookies only"
          onclick={consentStore.acceptAnalyticsOnly}>
          Analytics only
        </Button>
        <Button
          type="ghost"
          size="sm"
          class="w-full sm:w-auto"
          keyboardShortcut="D"
          shortcutScope={CONSENT_BANNER_SCOPE}
          shortcutLabel="Reject all cookies"
          onclick={consentStore.rejectAll}>
          Reject all
        </Button>
        <Button
          type="ghost"
          size="sm"
          onclick={openCustomize}
          keyboardShortcut={buttonKey('cookiesLink')}
          shortcutScope={CONSENT_BANNER_SCOPE}
          shortcutLabel="Cookie settings"
          class="w-full sm:ml-auto sm:w-auto">
          Cookie settings
        </Button>
      </div>
    </div>
  </aside>
{/if}

<Dialog
  bind:isOpen={consentStore.isCustomizeModalOpen}
  title="Cookie preferences"
  description="Manage your analytics and advertising privacy choices."
  size="2xl"
  class="w-[95vw] max-w-2xl"
  onClose={() => consentStore.closeCustomizeModal()}>
  <div class="flex flex-col gap-4 py-1">
    <div
      class="flex flex-col gap-2.5 rounded-md border border-border-subtle/70 bg-surface-card/50 p-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-text-secondary"
          >Quick presets</span>
        <span
          class="text-xs font-bold transition-colors"
          style="color: {presetColor}">
          {presetLabel}
        </span>
      </div>

      <div class="relative flex h-5 w-full items-center">
        <div
          class="pointer-events-none absolute inset-x-0 h-1.5 rounded-full bg-border-subtle">
        </div>
        <div
          class="pointer-events-none absolute inset-y-0 left-0 h-1.5 self-center rounded-full transition-[width,background-color] duration-200"
          style="width: {(presetSliderValue / 2)
            * 100}%; background-color: {presetColor}">
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="1"
          value={presetSliderValue}
          oninput={handlePresetSlider}
          aria-label="Quick cookie preset: allow all, analytics only, or deny all"
          style="--thumb-color: {presetColor}"
          class="preset-slider relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent outline-none focus:shadow-none focus:outline-none focus-visible:shadow-none focus-visible:outline-none" />
      </div>

      <div
        class="flex items-center justify-between text-2xs font-medium text-text-secondary">
        <span>Allow all</span>
        <span>Analytics only</span>
        <span>Deny all</span>
      </div>
    </div>

    <div
      class="divide-y divide-border-subtle/50 rounded-md border border-border-subtle/70 bg-surface-card/30">
      <div class="flex items-center justify-between gap-3 p-3 sm:p-3.5">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 class="text-xs font-bold text-text-primary">
            Behavioral analytics
          </h4>
          <p class="text-xs leading-snug text-text-secondary">
            Measures sessions, page views and interactions.
          </p>
        </div>

        <Dropdown
          size="sm"
          ariaLabel="Behavioral analytics preference"
          options={CONSENT_OPTIONS}
          bind:value={tempAnalytics} />
      </div>

      <div class="flex items-center justify-between gap-3 p-3 sm:p-3.5">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 class="text-xs font-bold text-text-primary">
            Advertising storage
          </h4>
          <p class="text-xs leading-snug text-text-secondary">
            Stores advertising identifiers.
          </p>
        </div>

        <Dropdown
          size="sm"
          ariaLabel="Advertising storage preference"
          options={CONSENT_OPTIONS}
          bind:value={tempAdStorage} />
      </div>

      <div class="flex items-center justify-between gap-3 p-3 sm:p-3.5">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 class="text-xs font-bold text-text-primary">Ad user data</h4>
          <p class="text-xs leading-snug text-text-secondary">
            Shares advertising measurement data.
          </p>
        </div>

        <Dropdown
          size="sm"
          ariaLabel="Ad user data preference"
          options={CONSENT_OPTIONS}
          bind:value={tempAdUserData} />
      </div>

      <div class="flex items-center justify-between gap-3 p-3 sm:p-3.5">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 class="text-xs font-bold text-text-primary">
            Ad personalization
          </h4>
          <p class="text-xs leading-snug text-text-secondary">
            Personalized advertising preferences.
          </p>
        </div>

        <Dropdown
          size="sm"
          ariaLabel="Ad personalization preference"
          options={CONSENT_OPTIONS}
          bind:value={tempAdPersonalization} />
      </div>
    </div>

    <div
      class="flex flex-col items-start gap-2 px-1 pt-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span class="text-xxs text-text-secondary"
        >Need to clear stored choices?</span>
      <Button
        type="secondary"
        tone="critical"
        size="sm"
        onclick={consentStore.resetVisitorConsent}
        keyboardShortcut="R"
        shortcutLabel="Reset choice"
        class="w-full sm:w-auto">
        <Trash class="size-3" />
        Reset choice
      </Button>
    </div>
  </div>

  {#snippet footer()}
    <div
      class="flex w-full flex-col-reverse items-center justify-end gap-2 sm:flex-row">
      <Button
        type="secondary"
        size="md"
        onclick={() => {
          applyPreset('all');
          saveCustomPreferences();
        }}
        keyboardShortcut="A"
        shortcutLabel="Accept all cookies"
        class="w-full sm:w-auto">
        Accept all
      </Button>

      <Button
        type="primary"
        size="md"
        onclick={saveCustomPreferences}
        keyboardShortcut={buttonKey('formSubmit')}
        shortcutLabel="Save preferences"
        class="w-full sm:w-auto">
        Save preferences
      </Button>
    </div>
  {/snippet}
</Dialog>

<style>
  .preset-slider::-moz-focus-outer {
    border: 0;
  }
  .preset-slider::-webkit-slider-runnable-track {
    height: 0.375rem;
    background: transparent;
  }
  .preset-slider::-webkit-slider-thumb {
    appearance: none;
    width: 1.1rem;
    height: 1.1rem;
    margin-top: -0.375rem;
    border-radius: 9999px;
    border: 2px solid var(--color-surface-elevated);
    background: var(--thumb-color);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .preset-slider::-moz-range-track {
    height: 0.375rem;
    background: transparent;
  }
  .preset-slider::-moz-range-thumb {
    width: 1.1rem;
    height: 1.1rem;
    border: 2px solid var(--color-surface-elevated);
    border-radius: 9999px;
    background: var(--thumb-color);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
</style>
