<script lang="ts">
  import SkipLink from './SkipLink.svelte';
  import SpotlightSearch from './SpotlightSearch.svelte';
  import ThemeSelect from './filter/ThemeSelect.svelte';
  import ContentFontSelect from './filter/ContentFontSelect.svelte';
  import AccessibilitySelect from './filter/AccessibilitySelect.svelte';
  import LanguageSelect from './filter/LanguageSelect.svelte';
  import ReadingOptionsMenu from './filter/ReadingOptionsMenu.svelte';
  import IconButton from './IconButton.svelte';
  import {themeStore} from '../stores/themeStore.svelte';
  import {ArrowLeft, BookOpenText} from '@lucide/svelte';
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
    readingMode?: boolean;
    onToggleReadingMode?: () => void;
  }

  let {
    ariaLabel,
    backHref,
    backLabel,
    showFontSelect = false,
    projects = [],
    languageSwitcher,
    readingMode = false,
    onToggleReadingMode
  }: Props = $props();
</script>

<SkipLink />

<nav
  class="fixed top-0 z-60 flex h-12 w-full items-center justify-between glass-card border-b border-border-subtle/30 px-3 font-sans shadow-2xs sm:h-14 sm:px-5"
  aria-label={ariaLabel}>
  <a
    href={backHref}
    class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border-subtle/50 bg-surface-card px-2.5 text-xs font-semibold whitespace-nowrap text-text-primary shadow-2xs transition-colors hover:bg-surface-hover hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:h-9 sm:px-4">
    <ArrowLeft class="size-3.5 shrink-0" />
    {backLabel}
  </a>

  <div class="flex items-center gap-1 sm:gap-1.5">
    {#if !readingMode}
      <SpotlightSearch
        {projects}
        {languageSwitcher} />
    {/if}
    {#if onToggleReadingMode}
      <IconButton
        ariaLabel={readingMode ? 'Exit reading mode' : 'Enter reading mode'}
        tooltip={readingMode ? 'Exit reading mode' : 'Reading mode'}
        tooltipPlacement="bottom"
        tooltipAlign="right"
        size="sm"
        onclick={onToggleReadingMode}
        class="border-border-subtle bg-surface backdrop-blur-none hover:border-accent hover:bg-surface-hover sm:h-9 sm:w-9 {(
          readingMode
        ) ?
          'border-accent text-accent'
        : ''}">
        <BookOpenText class="size-4" />
      </IconButton>
    {/if}
    <ThemeSelect
      theme={themeStore.current}
      onThemeChange={themeStore.apply} />
    {#if !readingMode && (showFontSelect || languageSwitcher)}
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
    {:else if !readingMode}
      <AccessibilitySelect />
    {/if}
  </div>
</nav>
