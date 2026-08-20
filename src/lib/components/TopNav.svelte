<script lang="ts">
  import SkipLink from './SkipLink.svelte';
  import SpotlightSearch from './SpotlightSearch.svelte';
  import ThemeSelect from './filter/ThemeSelect.svelte';
  import ContentFontSelect from './filter/ContentFontSelect.svelte';
  import AccessibilitySelect from './filter/AccessibilitySelect.svelte';
  import {themeStore} from '../stores/themeStore.svelte';

  interface Props {
    ariaLabel: string;
    backHref: string;
    backLabel: string;
    showFontSelect?: boolean;
  }

  let {
    ariaLabel,
    backHref,
    backLabel,
    showFontSelect = false
  }: Props = $props();
</script>

<SkipLink />

<nav
  class="fixed top-0 z-60 flex h-15 w-full items-center justify-between glass-card border-b border-border-subtle/60 px-3 font-sans shadow-xs sm:px-5"
  aria-label={ariaLabel}>
  <a
    href={backHref}
    class="inline-flex h-9 items-center justify-center rounded-sm border border-border-subtle bg-surface-card px-4 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover hover:text-copilot focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none">
    {backLabel}
  </a>

  <div class="flex items-center gap-2">
    <SpotlightSearch />
    <ThemeSelect
      theme={themeStore.current}
      onThemeChange={themeStore.apply}
      class="hidden md:inline-flex" />
    {#if showFontSelect}
      <ContentFontSelect class="hidden md:inline-flex" />
    {/if}
    <AccessibilitySelect class="hidden md:inline-flex" />
  </div>
</nav>
