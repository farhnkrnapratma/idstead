<script lang="ts">
  import {buttonKey, sectionCommandKey} from '$lib/shortcuts';
  import {shortcut} from '../utils/shortcut.svelte';
  import {cn} from '../utils/cn';
  import ThemeSelect from '../components/filter/ThemeSelect.svelte';
  import ContentFontSelect from '../components/filter/ContentFontSelect.svelte';
  import LanguageSelect from '../components/filter/LanguageSelect.svelte';
  import AccessibilitySelect from '../components/filter/AccessibilitySelect.svelte';
  import IconButton from '../components/IconButton.svelte';
  import {themeStore} from '../stores/themeStore.svelte';
  import {type SocialLink} from '../author';
  import BrandIcon from '../components/BrandIcon.svelte';
  import FooterLegalRow from './FooterLegalRow.svelte';
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
    languageSwitcher?: {
      slug: string;
      currentLanguage: string;
      availableLocales: string[];
    };
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
    languageSwitcher,
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
    <div class="grid grid-cols-1 gap-x-0 gap-y-1 md:grid-cols-12">
      <div class="md:col-span-12">
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
      </div>

      {#if resolvedDescription}
        <div class="min-w-0 pt-1 md:col-span-7 md:pr-6">
          <p class="max-w-md text-xs leading-relaxed text-text-secondary">
            {resolvedDescription}
          </p>
        </div>
      {/if}

      {#if resolvedNavItems.length > 0}
        <div
          class="min-w-0 border-t border-border-subtle/40 md:col-span-5 md:mt-0 md:border-t-0 md:border-l md:border-border-subtle/40 md:pl-6">
          <nav aria-label="Footer navigation">
            <ul
              class="grid grid-cols-2 gap-x-6 text-xs font-normal text-text-secondary">
              {#each resolvedNavItems as item, index (item.url)}
                <li
                  class="text-xs leading-7.25 {index % 2 === 0 ?
                    'md:pl-2.5'
                  : ''}">
                  {#if onNavClick}
                    <button
                      type="button"
                      onclick={() => onNavClick(item.url)}
                      use:shortcut={{
                        combo: sectionCommandKey(item.url),
                        label: item.label
                      }}
                      class="relative cursor-pointer text-left text-xs leading-7.25 font-normal text-text-secondary transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none">
                      {item.label}
                    </button>
                  {:else}
                    <a
                      href={item.url}
                      use:shortcut={{
                        combo: sectionCommandKey(item.url),
                        label: item.label
                      }}
                      class="relative cursor-pointer text-left text-xs leading-7.25 font-normal text-text-secondary transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none">
                      {item.label}
                    </a>
                  {/if}
                </li>
              {/each}
            </ul>
          </nav>
        </div>
      {/if}

      <div
        class="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-3 pt-4 md:col-span-12">
        {#if resolvedSocials.length > 0}
          <div class="flex flex-wrap items-center gap-1 sm:gap-1.5">
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
          class="flex flex-wrap items-center gap-1.5 sm:gap-2 {(
            resolvedSocials.length === 0
          ) ?
            'ml-auto'
          : ''}">
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
          {#if languageSwitcher}
            <LanguageSelect
              slug={languageSwitcher.slug}
              currentLanguage={languageSwitcher.currentLanguage}
              availableLocales={languageSwitcher.availableLocales}
              dropdownDirection="up" />
          {/if}
          <AccessibilitySelect dropdownDirection="up" />
        </div>
      </div>
    </div>
  </div>

  <div class="pt-4 text-center select-none">
    <FooterLegalRow name={resolvedName} />
  </div>
</footer>
