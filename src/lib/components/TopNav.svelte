<script lang="ts">
  import SkipLink from './SkipLink.svelte';
  import SpotlightSearch from './SpotlightSearch.svelte';
  import ThemeSelect from './filter/ThemeSelect.svelte';
  import ContentFontSelect from './filter/ContentFontSelect.svelte';
  import AccessibilitySelect from './filter/AccessibilitySelect.svelte';
  import LanguageSelect from './filter/LanguageSelect.svelte';
  import ReadingOptionsMenu from './filter/ReadingOptionsMenu.svelte';
  import {themeStore} from '../stores/themeStore.svelte';
  import {ArrowLeft} from '@lucide/svelte';
  import type {Project} from '../types';

  interface Props {
    ariaLabel: string;
    backHref: string;
    backLabel: string;
    showFontSelect?: boolean;
    projects?: Project[];
    languageSwitcher?: {
      slug: string;
      currentLanguage: string;
      availableLocales: string[];
    };
  }

  let {
    ariaLabel,
    backHref,
    backLabel,
    showFontSelect = false,
    projects = [],
    languageSwitcher
  }: Props = $props();
</script>

<SkipLink />

<nav
  class="fixed top-0 z-60 flex h-12 w-full items-center justify-between glass-card border-b border-border-subtle/30 px-3 font-sans shadow-2xs sm:h-14 sm:px-5"
  aria-label={ariaLabel}>
  <a
    href={backHref}
    class="inline-flex h-8 items-center justify-center gap-1.5 rounded-sm border border-border-subtle/50 bg-surface-card px-2.5 text-xs font-semibold whitespace-nowrap text-text-primary shadow-2xs transition-colors hover:bg-surface-hover hover:text-copilot focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none sm:h-9 sm:px-4">
    <ArrowLeft class="size-3.5 shrink-0" />
    {backLabel}
  </a>

  <div class="flex items-center gap-1 sm:gap-1.5">
    <SpotlightSearch
      {projects}
      {languageSwitcher} />
    <ThemeSelect
      theme={themeStore.current}
      onThemeChange={themeStore.apply} />
    {#if showFontSelect || languageSwitcher}
      <div class="sm:hidden">
        <ReadingOptionsMenu
          {showFontSelect}
          {languageSwitcher} />
      </div>
      {#if showFontSelect}
        <div class="hidden sm:inline-flex">
          <ContentFontSelect />
        </div>
      {/if}
      {#if languageSwitcher}
        <div class="hidden sm:inline-flex">
          <LanguageSelect
            slug={languageSwitcher.slug}
            currentLanguage={languageSwitcher.currentLanguage}
            availableLocales={languageSwitcher.availableLocales} />
        </div>
      {/if}
      <div class="hidden sm:inline-flex">
        <AccessibilitySelect />
      </div>
    {:else}
      <AccessibilitySelect />
    {/if}
  </div>
</nav>
