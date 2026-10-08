<script lang="ts">
  import {buttonKey, sectionCommandKey} from '#lib/shortcuts.ts';
  import {shortcut} from '../utils/shortcut.svelte';
  import {cn} from '../utils/cn';
  import SpotlightSearch from '../components/SpotlightSearch.svelte';
  import ThemeSelect from '../components/filter/ThemeSelect.svelte';
  import ContentFontSelect from '../components/filter/ContentFontSelect.svelte';
  import AccessibilitySelect from '../components/filter/AccessibilitySelect.svelte';
  import IconButton from '../components/IconButton.svelte';
  import {themeStore} from '../stores/themeStore.svelte';
  import {type SocialLink} from '../author';
  import BrandIcon from '../components/BrandIcon.svelte';
  import FooterLegalRow from './FooterLegalRow.svelte';
  import StatusBadge from '../components/StatusBadge.svelte';
  import {BookOpenText} from '@lucide/svelte';

  import {page} from '$app/state';

  interface NavItem {
    label: string;
    url: string;
  }

  interface Props {
    name?: string;
    headline?: string;
    description?: string;
    navItems?: NavItem[];
    socials?: SocialLink[];
    onNavClick?: (url: string) => void;
    showFontSelect?: boolean;
    readingMode?: boolean;
    onToggleReadingMode?: () => void;
    width?: 'standard' | 'full' | 'reading';
    class?: string;
  }

  const defaultNavItems: NavItem[] = [
    {label: 'Home', url: '/'},
    {label: 'Projects', url: '/#projects'},
    {label: 'Blog', url: '/#blog'},
    {label: 'CV', url: '/#cv'},
    {label: 'Funding', url: '/#funding'},
    {label: 'Contact', url: '/#contact'}
  ];

  let {
    name = '',
    headline = '',
    description = '',
    navItems = [],
    socials = [],
    onNavClick,
    showFontSelect = false,
    readingMode = false,
    onToggleReadingMode,
    width = 'standard',
    class: className = ''
  }: Props = $props();

  const widthStyles = {
    standard: 'px-3 sm:px-6 md:w-[80%] lg:w-[50%]',
    reading: 'px-3 sm:px-6 md:w-[80%] lg:w-[50%]',
    full: 'w-full max-w-full px-0'
  };

  let pageAuthor = $derived((page?.data as any)?.author);

  let resolvedName = $derived(name || pageAuthor?.name || '');
  let resolvedHeadline = $derived(
    headline || pageAuthor?.headline || pageAuthor?.jobTitle || ''
  );
  let resolvedDescription = $derived(description || pageAuthor?.bio || '');

  let resolvedNavItems = $derived(
    navItems.length > 0 ? navItems : defaultNavItems
  );

  let resolvedSocials = $derived(
    Array.isArray(socials) && socials.length > 0 ? socials
    : pageAuthor?.socialLinks && pageAuthor.socialLinks.length > 0 ?
      pageAuthor.socialLinks
    : []
  );
</script>

<footer
  class={cn(
    'relative z-10 mx-auto mt-auto w-full max-w-full pt-0 font-sans text-xs text-text-muted',
    width === 'standard' ? 'pb-20 md:pb-20 lg:pb-8' : 'pb-0',
    widthStyles[width],
    className
  )}>
  <div class="rounded-md glass-card p-3.5 sm:p-6">
    <div class="flex flex-col gap-5 sm:gap-6">
      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="flex min-w-0 flex-col gap-0.5">
          <h3
            class="text-base font-bold tracking-tight text-text-primary sm:text-lg">
            {resolvedName}
          </h3>
          {#if resolvedHeadline}
            <p class="text-xs font-medium text-text-muted sm:text-sm">
              {resolvedHeadline}
            </p>
          {/if}
        </div>
        {#if resolvedDescription}
          <p class="max-w-lg text-xs leading-relaxed text-text-secondary">
            {resolvedDescription}
          </p>
        {/if}
      </div>

      <div
        class="flex flex-col gap-5 border-t border-border-subtle pt-5 sm:flex-row sm:items-stretch sm:justify-between sm:gap-10 sm:pt-6">
        {#if resolvedNavItems.length > 0}
          <nav
            aria-label="Footer navigation"
            class="flex min-w-0 flex-col gap-2 sm:max-w-xs sm:flex-1 sm:justify-between">
            <h4 class="text-xs font-semibold text-text-primary">Navigation</h4>
            <ul
              class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-normal text-text-secondary">
              {#each resolvedNavItems as item (item.url)}
                <li class="text-xs">
                  {#if onNavClick}
                    <button
                      type="button"
                      onclick={() => onNavClick(item.url)}
                      use:shortcut={{
                        combo: sectionCommandKey(item.url),
                        label: item.label
                      }}
                      class="relative cursor-pointer text-left text-xs font-normal text-text-secondary transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none">
                      {item.label}
                    </button>
                  {:else}
                    <a
                      href={item.url}
                      use:shortcut={{
                        combo: sectionCommandKey(item.url),
                        label: item.label
                      }}
                      class="relative cursor-pointer text-left text-xs font-normal text-text-secondary transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none">
                      {item.label}
                    </a>
                  {/if}
                </li>
              {/each}
            </ul>
          </nav>
        {/if}

        <div
          class="flex flex-col gap-3 sm:items-end sm:justify-between sm:gap-4">
          {#if resolvedSocials.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each resolvedSocials as item (item.url + item.platform)}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.platform}
                  title={item.platform}
                  use:shortcut={{group: 'social', label: item.platform}}
                  class="relative flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-text-muted transition-all hover:bg-surface-hover hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:size-9">
                  <BrandIcon
                    icon={item.icon}
                    class="size-4 text-base leading-none sm:size-4.5 sm:text-lg" />
                </a>
              {/each}
            </div>
          {/if}

          <div
            class="flex flex-wrap items-center gap-1.5 sm:justify-end sm:gap-2">
            <SpotlightSearch variant="icon" />
            {#if onToggleReadingMode}
              <IconButton
                ariaLabel={readingMode ? 'Exit reading mode' : (
                  'Enter reading mode'
                )}
                tooltip={readingMode ? 'Exit reading mode' : 'Reading mode'}
                keyboardShortcut={buttonKey('readingMode')}
                shortcutLabel="Reading mode"
                tooltipPlacement="top"
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
              onThemeChange={themeStore.apply}
              dropdownDirection="up" />
            {#if showFontSelect}
              <ContentFontSelect dropdownDirection="up" />
            {/if}
            <AccessibilitySelect dropdownDirection="up" />
          </div>
        </div>
      </div>

      <div
        class="flex flex-col items-center gap-3 border-t border-border-subtle pt-4 text-center select-none sm:pt-5">
        <FooterLegalRow name={resolvedName} />
        <StatusBadge />
      </div>
    </div>
  </div>
</footer>

<style>
  @reference '../../routes/global.css';

  footer {
    @apply font-sans text-xs leading-normal font-normal not-italic;
  }

  h3 {
    @apply text-base font-bold not-italic sm:text-lg;
  }

  h4 {
    @apply text-xs font-semibold not-italic;
  }
</style>
