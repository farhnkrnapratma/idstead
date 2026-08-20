<script lang="ts">
  import {onMount, untrack} from 'svelte';
  import {fade} from 'svelte/transition';
  import {ShieldCheck, X, ChevronDown, Check, Trash2} from '@lucide/svelte';
  import {
    consentStore,
    type ConsentStatus
  } from '../stores/consentStore.svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';

  let tempAnalytics = $state<ConsentStatus>('denied');
  let tempAdStorage = $state<ConsentStatus>('denied');
  let tempAdUserData = $state<ConsentStatus>('denied');
  let tempAdPersonalization = $state<ConsentStatus>('denied');

  type DropdownKey =
    'analytics' | 'ad_storage' | 'ad_user_data' | 'ad_personalization' | null;
  let activeDropdown = $state<DropdownKey>(null);

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
        activeDropdown = null;
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
    activeDropdown = null;
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
    presetSliderValue === 0 ? 'var(--color-success)'
    : presetSliderValue === 1 ? 'var(--color-warning)'
    : 'var(--color-danger)'
  );

  const presetLabel = $derived(
    presetSliderValue === 0 ? 'Allow All'
    : presetSliderValue === 1 ? 'Analytics Only'
    : 'Deny All'
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
    aria-label="Cookie and Privacy Consent"
    class="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-xl rounded-sm glass-overlay p-5 transition-all sm:right-auto sm:bottom-6 sm:left-6 sm:w-full">
    <div class="flex flex-col gap-4">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-copilot/15 text-copilot">
            <ShieldCheck class="size-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-text-primary">
              Cookie & Privacy Preferences
            </h3>
            <p class="text-xxs text-text-muted">
              We use cookies to analyze site traffic and enhance your
              experience.
            </p>
          </div>
        </div>
        <button
          type="button"
          onclick={consentStore.closeBanner}
          aria-label="Dismiss banner"
          class="shrink-0 text-text-muted hover:text-text-primary">
          <X class="size-3.5" />
        </button>
      </div>

      <p class="text-xs leading-relaxed text-text-secondary">
        Choose which data processing signals you wish to allow. You can update
        your choice at any time. See our <a
          href="/privacy"
          class="font-semibold text-copilot underline hover:text-copilot-hover"
          >Privacy Policy</a> for full details.
      </p>

      <div class="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="primary"
          size="sm"
          onclick={consentStore.acceptAll}>
          Accept all
        </Button>
        <Button
          type="secondary"
          size="sm"
          onclick={consentStore.acceptAnalyticsOnly}>
          Analytics only
        </Button>
        <Button
          type="ghost"
          size="sm"
          onclick={consentStore.rejectAll}>
          Reject all
        </Button>
        <button
          type="button"
          onclick={openCustomize}
          class="ml-auto text-xs font-semibold text-text-muted hover:text-copilot hover:underline">
          Cookie Settings
        </button>
      </div>
    </div>
  </aside>
{/if}

<Dialog
  bind:isOpen={consentStore.isCustomizeModalOpen}
  title="Cookie Preferences"
  description="Manage your analytics and advertising privacy choices."
  size="2xl"
  class="w-[95vw] max-w-2xl"
  onClose={() => consentStore.closeCustomizeModal()}>
  <div class="flex flex-col gap-4 py-1">
    <div
      class="flex flex-col gap-2.5 rounded-sm border border-border-subtle/70 bg-surface-card/50 p-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold text-text-secondary"
          >Quick Presets</span>
        <span
          class="text-xs font-bold text-(--preset-color) transition-colors"
          style="--preset-color: {presetColor}">
          {presetLabel}
        </span>
      </div>

      <div class="relative flex h-5 w-full items-center">
        <div
          class="pointer-events-none absolute inset-x-0 h-1.5 rounded-full bg-border-subtle">
        </div>
        <div
          class="pointer-events-none absolute inset-y-0 left-0 h-1.5 w-(--preset-slider-w) self-center rounded-full bg-(--preset-color) transition-[width,background-color] duration-200"
          style="--preset-slider-w: {(presetSliderValue / 2)
            * 100}%; --preset-color: {presetColor};">
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="1"
          value={presetSliderValue}
          oninput={handlePresetSlider}
          aria-label="Quick cookie preset: allow all, analytics only, or deny all"
          class="preset-slider relative z-10 w-full cursor-pointer appearance-none bg-transparent"
          style="--thumb-color: {presetColor}" />
      </div>

      <div
        class="flex items-center justify-between text-2xs font-medium text-text-secondary">
        <span>Allow All</span>
        <span>Analytics Only</span>
        <span>Deny All</span>
      </div>
    </div>

    <div
      class="divide-y divide-border-subtle/50 rounded-sm border border-border-subtle/70 bg-surface-card/30">
      <div class="flex items-center justify-between gap-3 p-3 sm:p-3.5">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 class="text-xs font-bold text-text-primary">
            Behavioral Analytics
          </h4>
          <p class="text-xs leading-snug text-text-secondary">
            Measures sessions, page views and interactions.
          </p>
        </div>

        <div class="relative shrink-0">
          <button
            type="button"
            onclick={() =>
              (activeDropdown =
                activeDropdown === 'analytics' ? null : 'analytics')}
            aria-label="Behavioral Analytics preference"
            aria-expanded={activeDropdown === 'analytics'}
            aria-haspopup="listbox"
            class="inline-flex h-8 min-w-22 cursor-pointer items-center justify-between gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-2.5 text-xs font-semibold text-text-primary shadow-2xs transition-all hover:border-border-subtle/80 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none">
            <span class="leading-none"
              >{tempAnalytics === 'granted' ? 'Allow' : 'Deny'}</span>
            <span
              class="inline-flex h-4 w-4 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                activeDropdown === 'analytics'
              ) ?
                'rotate-180'
              : ''}">
              <ChevronDown class="size-3 leading-none" />
            </span>
          </button>

          {#if activeDropdown === 'analytics'}
            <button
              type="button"
              class="fixed inset-0 z-40 cursor-default"
              onclick={() => (activeDropdown = null)}
              aria-label="Close menu"></button>
            <div
              role="listbox"
              aria-label="Behavioral Analytics options"
              class="absolute top-[calc(100%+8px)] left-1/2 z-60 flex w-full w-max min-w-full -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl">
              <div
                class="relative z-10 flex flex-col overflow-hidden rounded-sm">
                <button
                  type="button"
                  role="option"
                  aria-selected={tempAnalytics === 'denied'}
                  onclick={() => {
                    tempAnalytics = 'denied';
                    activeDropdown = null;
                  }}
                  class="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors {(
                    tempAnalytics === 'denied'
                  ) ?
                    'bg-copilot/10 text-copilot'
                  : 'text-text-primary hover:bg-surface-hover'}">
                  <span>Deny</span>
                  {#if tempAnalytics === 'denied'}
                    <Check class="size-3.5 shrink-0 text-copilot" />
                  {/if}
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={tempAnalytics === 'granted'}
                  onclick={() => {
                    tempAnalytics = 'granted';
                    activeDropdown = null;
                  }}
                  class="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors {(
                    tempAnalytics === 'granted'
                  ) ?
                    'bg-copilot/10 text-copilot'
                  : 'text-text-primary hover:bg-surface-hover'}">
                  <span>Allow</span>
                  {#if tempAnalytics === 'granted'}
                    <Check class="size-3.5 shrink-0 text-copilot" />
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 p-3 sm:p-3.5">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 class="text-xs font-bold text-text-primary">
            Advertising Storage
          </h4>
          <p class="text-xs leading-snug text-text-secondary">
            Stores advertising identifiers.
          </p>
        </div>

        <div class="relative shrink-0">
          <button
            type="button"
            onclick={() =>
              (activeDropdown =
                activeDropdown === 'ad_storage' ? null : 'ad_storage')}
            aria-label="Advertising Storage preference"
            aria-expanded={activeDropdown === 'ad_storage'}
            aria-haspopup="listbox"
            class="inline-flex h-8 min-w-22 cursor-pointer items-center justify-between gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-2.5 text-xs font-semibold text-text-primary shadow-2xs transition-all hover:border-border-subtle/80 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none">
            <span class="leading-none"
              >{tempAdStorage === 'granted' ? 'Allow' : 'Deny'}</span>
            <span
              class="inline-flex h-4 w-4 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                activeDropdown === 'ad_storage'
              ) ?
                'rotate-180'
              : ''}">
              <ChevronDown class="size-3 leading-none" />
            </span>
          </button>

          {#if activeDropdown === 'ad_storage'}
            <button
              type="button"
              class="fixed inset-0 z-40 cursor-default"
              onclick={() => (activeDropdown = null)}
              aria-label="Close menu"></button>
            <div
              role="listbox"
              aria-label="Advertising Storage options"
              class="absolute top-[calc(100%+8px)] left-1/2 z-60 flex w-full w-max min-w-full -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl">
              <div
                class="relative z-10 flex flex-col overflow-hidden rounded-sm">
                <button
                  type="button"
                  role="option"
                  aria-selected={tempAdStorage === 'denied'}
                  onclick={() => {
                    tempAdStorage = 'denied';
                    activeDropdown = null;
                  }}
                  class="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors {(
                    tempAdStorage === 'denied'
                  ) ?
                    'bg-copilot/10 text-copilot'
                  : 'text-text-primary hover:bg-surface-hover'}">
                  <span>Deny</span>
                  {#if tempAdStorage === 'denied'}
                    <Check class="size-3.5 shrink-0 text-copilot" />
                  {/if}
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={tempAdStorage === 'granted'}
                  onclick={() => {
                    tempAdStorage = 'granted';
                    activeDropdown = null;
                  }}
                  class="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors {(
                    tempAdStorage === 'granted'
                  ) ?
                    'bg-copilot/10 text-copilot'
                  : 'text-text-primary hover:bg-surface-hover'}">
                  <span>Allow</span>
                  {#if tempAdStorage === 'granted'}
                    <Check class="size-3.5 shrink-0 text-copilot" />
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 p-3 sm:p-3.5">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 class="text-xs font-bold text-text-primary">Ad User Data</h4>
          <p class="text-xs leading-snug text-text-secondary">
            Shares advertising measurement data.
          </p>
        </div>

        <div class="relative shrink-0">
          <button
            type="button"
            onclick={() =>
              (activeDropdown =
                activeDropdown === 'ad_user_data' ? null : 'ad_user_data')}
            aria-label="Ad User Data preference"
            aria-expanded={activeDropdown === 'ad_user_data'}
            aria-haspopup="listbox"
            class="inline-flex h-8 min-w-22 cursor-pointer items-center justify-between gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-2.5 text-xs font-semibold text-text-primary shadow-2xs transition-all hover:border-border-subtle/80 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none">
            <span class="leading-none"
              >{tempAdUserData === 'granted' ? 'Allow' : 'Deny'}</span>
            <span
              class="inline-flex h-4 w-4 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                activeDropdown === 'ad_user_data'
              ) ?
                'rotate-180'
              : ''}">
              <ChevronDown class="size-3 leading-none" />
            </span>
          </button>

          {#if activeDropdown === 'ad_user_data'}
            <button
              type="button"
              class="fixed inset-0 z-40 cursor-default"
              onclick={() => (activeDropdown = null)}
              aria-label="Close menu"></button>
            <div
              role="listbox"
              aria-label="Ad User Data options"
              class="absolute top-[calc(100%+8px)] left-1/2 z-60 flex w-full w-max min-w-full -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl">
              <div
                class="relative z-10 flex flex-col overflow-hidden rounded-sm">
                <button
                  type="button"
                  role="option"
                  aria-selected={tempAdUserData === 'denied'}
                  onclick={() => {
                    tempAdUserData = 'denied';
                    activeDropdown = null;
                  }}
                  class="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors {(
                    tempAdUserData === 'denied'
                  ) ?
                    'bg-copilot/10 text-copilot'
                  : 'text-text-primary hover:bg-surface-hover'}">
                  <span>Deny</span>
                  {#if tempAdUserData === 'denied'}
                    <Check class="size-3.5 shrink-0 text-copilot" />
                  {/if}
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={tempAdUserData === 'granted'}
                  onclick={() => {
                    tempAdUserData = 'granted';
                    activeDropdown = null;
                  }}
                  class="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors {(
                    tempAdUserData === 'granted'
                  ) ?
                    'bg-copilot/10 text-copilot'
                  : 'text-text-primary hover:bg-surface-hover'}">
                  <span>Allow</span>
                  {#if tempAdUserData === 'granted'}
                    <Check class="size-3.5 shrink-0 text-copilot" />
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 p-3 sm:p-3.5">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 class="text-xs font-bold text-text-primary">
            Ad Personalization
          </h4>
          <p class="text-xs leading-snug text-text-secondary">
            Personalized advertising preferences.
          </p>
        </div>

        <div class="relative shrink-0">
          <button
            type="button"
            onclick={() =>
              (activeDropdown =
                activeDropdown === 'ad_personalization' ? null : (
                  'ad_personalization'
                ))}
            aria-label="Ad Personalization preference"
            aria-expanded={activeDropdown === 'ad_personalization'}
            aria-haspopup="listbox"
            class="inline-flex h-8 min-w-22 cursor-pointer items-center justify-between gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-2.5 text-xs font-semibold text-text-primary shadow-2xs transition-all hover:border-border-subtle/80 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none">
            <span class="flex-1 text-left leading-none"
              >{tempAdPersonalization === 'granted' ? 'Allow' : 'Deny'}</span>
            <span
              class="inline-flex h-4 w-4 shrink-0 origin-center items-center justify-center text-text-muted transition-transform duration-200 ease-out {(
                activeDropdown === 'ad_personalization'
              ) ?
                'rotate-180'
              : ''}">
              <ChevronDown class="size-3 leading-none" />
            </span>
          </button>

          {#if activeDropdown === 'ad_personalization'}
            <button
              type="button"
              class="fixed inset-0 z-40 cursor-default"
              onclick={() => (activeDropdown = null)}
              aria-label="Close menu"></button>
            <div
              role="listbox"
              aria-label="Ad Personalization options"
              class="absolute top-[calc(100%+8px)] left-1/2 z-60 flex w-full w-max min-w-full -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl">
              <div
                class="relative z-10 flex flex-col overflow-hidden rounded-sm">
                <button
                  type="button"
                  role="option"
                  aria-selected={tempAdPersonalization === 'denied'}
                  onclick={() => {
                    tempAdPersonalization = 'denied';
                    activeDropdown = null;
                  }}
                  class="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors {(
                    tempAdPersonalization === 'denied'
                  ) ?
                    'bg-copilot/10 text-copilot'
                  : 'text-text-primary hover:bg-surface-hover'}">
                  <span>Deny</span>
                  {#if tempAdPersonalization === 'denied'}
                    <Check class="size-3.5 shrink-0 text-copilot" />
                  {/if}
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={tempAdPersonalization === 'granted'}
                  onclick={() => {
                    tempAdPersonalization = 'granted';
                    activeDropdown = null;
                  }}
                  class="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors {(
                    tempAdPersonalization === 'granted'
                  ) ?
                    'bg-copilot/10 text-copilot'
                  : 'text-text-primary hover:bg-surface-hover'}">
                  <span>Allow</span>
                  {#if tempAdPersonalization === 'granted'}
                    <Check class="size-3.5 shrink-0 text-copilot" />
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-3 px-1 pt-1">
      <span class="text-xxs text-text-secondary"
        >Need to clear stored choices?</span>
      <button
        type="button"
        onclick={consentStore.resetVisitorConsent}
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-danger/30 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger transition-colors hover:border-danger/50 hover:bg-danger/20">
        <Trash2 class="size-3" />
        Reset choice
      </button>
    </div>
  </div>

  {#snippet footer()}
    <div
      class="flex w-full flex-col-reverse items-center justify-end gap-2 sm:flex-row">
      <Button
        type="secondary"
        size="md"
        showEscHint
        onclick={() => consentStore.closeCustomizeModal()}
        class="w-full sm:w-auto">
        Cancel
      </Button>

      <Button
        type="secondary"
        size="md"
        onclick={() => {
          applyPreset('all');
          saveCustomPreferences();
        }}
        class="w-full sm:w-auto">
        Accept All
      </Button>

      <Button
        type="primary"
        size="md"
        onclick={saveCustomPreferences}
        class="w-full sm:w-auto">
        Save Preferences
      </Button>
    </div>
  {/snippet}
</Dialog>

<style>
  .preset-slider {
    height: 1.25rem;
    outline: none;
  }
  .preset-slider:focus,
  .preset-slider:focus-visible {
    outline: none;
    box-shadow: none;
  }
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
