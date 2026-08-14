<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'
  import ThemeSelect from '../components/filter/ThemeSelect.svelte'
  import AccessibilitySelect from '../components/filter/AccessibilitySelect.svelte'
  import {themeStore} from '../stores/themeStore.svelte'
  import {sanitizeIconClass, type SocialLink} from '../author'
  import FooterLegalRow from './FooterLegalRow.svelte'

  import {page} from '$app/state'

  interface NavItem {
    label: string
    url: string
  }

  interface Props {
    name?: string
    headline?: string
    description?: string
    navItems?: NavItem[]
    socials?: SocialLink[]
    onNavClick?: (url: string) => void
    class?: string
  }

  const defaultNavItems: NavItem[] = [
    {label: 'Home', url: '/'},
    {label: 'Projects', url: '/#projects'},
    {label: 'Blog', url: '/#blog'},
    {label: 'CV', url: '/#cv'},
    {label: 'Funding', url: '/#funding'},
    {label: 'Contact', url: '/#contact'}
  ]

  let {
    name = '',
    headline = '',
    description = '',
    navItems = [],
    socials = [],
    onNavClick,
    class: className = ''
  }: Props = $props()

  let pageAuthor = $derived((page?.data as any)?.author)

  let resolvedName = $derived(name || pageAuthor?.name || '')
  let resolvedHeadline = $derived(
    headline || pageAuthor?.headline || pageAuthor?.jobTitle || ''
  )
  let resolvedDescription = $derived(description || pageAuthor?.bio || '')

  let resolvedNavItems = $derived(
    navItems.length > 0 ? navItems : defaultNavItems
  )

  let resolvedSocials = $derived(
    Array.isArray(socials) && socials.length > 0 ? socials
    : pageAuthor?.socialLinks && pageAuthor.socialLinks.length > 0 ?
      pageAuthor.socialLinks
    : []
  )
</script>

<footer
  class={cn(
    'relative z-10 mx-auto mt-auto w-full max-w-full overflow-hidden px-6 pt-0 pb-20 font-sans text-xs text-text-muted md:w-[80%] md:pb-20 lg:w-[65%] lg:pb-6 xl:w-[55%]',
    className
  )}>
  <div class="rounded-sm glass-card p-4 sm:p-6">
    <div class="grid grid-cols-1 gap-x-0 gap-y-1 md:grid-cols-12">
      <div class="md:col-span-12">
        <div class="flex min-w-0 flex-col gap-0.5">
          <h3
            class="text-base font-bold tracking-tight text-text-primary sm:text-lg">
            {resolvedName}
          </h3>
          {#if resolvedHeadline}
            <p class="text-xs font-medium text-text-secondary sm:text-sm">
              {resolvedHeadline}
            </p>
          {/if}
        </div>
      </div>

      {#if resolvedDescription}
        <div class="pt-1 md:col-span-7 md:pr-6">
          <p class="max-w-md text-xs leading-relaxed text-text-secondary">
            {resolvedDescription}
          </p>
        </div>
      {/if}

      {#if resolvedNavItems.length > 0}
        <div
          class="border-t border-border-subtle/40 md:col-span-5 md:mt-0 md:border-t-0 md:border-l md:border-border-subtle/40 md:pl-6">
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
                      class="cursor-pointer text-left text-xs leading-7.25 font-normal text-text-secondary transition-colors hover:text-copilot focus-visible:text-copilot focus-visible:outline-none">
                      {item.label}
                    </button>
                  {:else}
                    <a
                      href={item.url}
                      class="cursor-pointer text-left text-xs leading-7.25 font-normal text-text-secondary transition-colors hover:text-copilot focus-visible:text-copilot focus-visible:outline-none">
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
        class="flex flex-wrap items-center justify-between gap-3 pt-4 md:col-span-12">
        {#if resolvedSocials.length > 0}
          <div
            class="flex max-w-[calc(6*2.25rem+5*0.625rem)] flex-wrap items-center gap-2 sm:gap-2.5">
            {#each resolvedSocials as item (item.url + item.platform)}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
                aria-label={item.platform}>
                <i
                  class="{sanitizeIconClass(
                    item.icon,
                    'bi bi-people'
                  )} text-base leading-none"
                  aria-hidden="true"></i>
              </a>
            {/each}
          </div>
        {/if}

        <div
          class="flex items-center gap-2 {resolvedSocials.length === 0 ?
            'ml-auto'
          : ''}">
          <ThemeSelect
            theme={themeStore.current}
            onThemeChange={themeStore.apply}
            dropdownDirection="up" />
          <AccessibilitySelect dropdownDirection="up" />
        </div>
      </div>
    </div>
  </div>

  <div class="pt-4 text-center select-none">
    <FooterLegalRow name={resolvedName} />
  </div>
</footer>
