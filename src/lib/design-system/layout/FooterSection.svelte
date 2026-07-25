<!-- @format -->
<script lang="ts">
  import {onMount} from 'svelte'
  import {cn} from '../utils/cn'
  import {consentStore} from '../../stores/consentStore.svelte'
  import ThemeSelect from '../components/filter/ThemeSelect.svelte'

  interface NavItem {
    label: string
    url: string
  }

  interface Props {
    name?: string
    description?: string
    navItems?: NavItem[]
    onNavClick?: (url: string) => void
    class?: string
  }

  const defaultNavItems: NavItem[] = [
    {label: 'Home', url: '/'},
    {label: 'Projects', url: '/#projects'},
    {label: 'Blogs', url: '/#blogs'},
    {label: 'CV', url: '/#cv'},
    {label: 'Funding', url: '/#funding'},
    {label: 'Contacts', url: '/#contacts'}
  ]

  type Theme = 'auto' | 'dark' | 'light'

  let {
    name = 'Farhan Kurnia Pratama',
    description = 'Security-focused Software Engineer with expertise in Linux/Unix, AI, and Open-Source Software, dedicated to building reliable, maintainable, and privacy-centric systems.',
    navItems = [],
    onNavClick,
    class: className = ''
  }: Props = $props()

  let theme = $state<Theme>('auto')

  let resolvedNavItems = $derived(
    navItems.length > 0 ? navItems : defaultNavItems
  )

  function applyTheme(newTheme: Theme) {
    theme = newTheme
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme)
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else if (newTheme === 'light') {
        document.documentElement.classList.remove('dark')
      } else {
        const prefersDark = window.matchMedia(
          '(prefers-color-scheme: dark)'
        ).matches
        if (prefersDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme') as Theme
      if (saved) {
        theme = saved
      }
    }
  })
</script>

<footer
  class={cn(
    'relative z-10 mx-auto mt-auto w-full max-w-full overflow-hidden px-4 pt-0 pb-20 font-sans text-xs text-text-muted sm:px-6 md:w-[80%] md:pb-20 lg:w-[60%] lg:pb-6 xl:w-[50%]',
    className
  )}>
  <div
    class="rounded-2xl border border-border-subtle/80 bg-surface-card/60 p-4 shadow-2xs sm:p-6">
    <div class="grid grid-cols-1 gap-x-0 gap-y-1 md:grid-cols-12">
      <div class="md:col-span-12">
        <div class="flex min-w-0 flex-col gap-0.5">
          <h3
            class="text-base font-bold tracking-tight text-text-primary sm:text-lg">
            {name}
          </h3>
          <p class="text-xs font-medium text-text-secondary sm:text-sm">
            Linux/Unix, AI, Open-Source Software, and Cybersecurity.
          </p>
        </div>
      </div>

      <div class="pt-1 md:col-span-7 md:pr-6">
        <p class="max-w-md text-xs leading-relaxed text-text-secondary">
          {description}
        </p>
      </div>

      {#if resolvedNavItems.length > 0}
        <div
          class="mt-3 border-t border-border-subtle/40 pt-3 md:col-span-5 md:mt-0 md:border-t-0 md:border-l md:border-border-subtle/40 md:pt-0.5 md:pl-6">
          <nav aria-label="Footer navigation">
            <ul
              class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-normal text-text-secondary">
              {#each resolvedNavItems as item, index (item.url)}
                <li
                  class="text-xs leading-[29px] {index % 2 === 0 ?
                    'md:pl-2.5'
                  : ''}">
                  {#if onNavClick}
                    <button
                      type="button"
                      onclick={() => onNavClick(item.url)}
                      class="cursor-pointer text-left text-xs leading-[29px] font-normal text-text-secondary transition-colors hover:text-copilot focus-visible:text-copilot focus-visible:outline-none">
                      {item.label}
                    </button>
                  {:else}
                    <a
                      href={item.url}
                      class="cursor-pointer text-left text-xs leading-[29px] font-normal text-text-secondary transition-colors hover:text-copilot focus-visible:text-copilot focus-visible:outline-none">
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
        <div class="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <a
            href="https://github.com/farhnkrnapratma"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
            aria-label="GitHub profile (opens in a new tab)">
            <i class="bi bi-github text-base leading-none" aria-hidden="true"
            ></i>
          </a>
          <a
            href="https://linkedin.com/in/farhnkrnapratma"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
            aria-label="LinkedIn profile (opens in a new tab)">
            <i class="bi bi-linkedin text-base leading-none" aria-hidden="true"
            ></i>
          </a>
          <a
            href="https://x.com/farhnkrnapratma"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
            aria-label="X profile (opens in a new tab)">
            <i class="bi bi-twitter-x text-base leading-none" aria-hidden="true"
            ></i>
          </a>
          <a
            href="https://facebook.com/farhnkrnapratma"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
            aria-label="Facebook profile (opens in a new tab)">
            <i class="bi bi-facebook text-base leading-none" aria-hidden="true"
            ></i>
          </a>
          <a
            href="https://instagram.com/farhnkrnapratma"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
            aria-label="Instagram profile (opens in a new tab)">
            <i class="bi bi-instagram text-base leading-none" aria-hidden="true"
            ></i>
          </a>
          <a
            href="https://threads.net/@farhnkrnapratma"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-copilot focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none"
            aria-label="Threads profile (opens in a new tab)">
            <i class="bi bi-threads text-base leading-none" aria-hidden="true"
            ></i>
          </a>
        </div>

        <div class="relative w-fit">
          <ThemeSelect
            {theme}
            onThemeChange={applyTheme}
            dropdownDirection="up" />
        </div>
      </div>
    </div>
  </div>

  <div class="pt-4 text-center select-none">
    <div
      class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-text-muted">
      <span class="inline-flex shrink-0 items-center text-text-muted">
        &copy; {new Date().getFullYear()}
        {name}.
      </span>
      <a
        href="/privacy"
        class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
        Privacy
      </a>
      <button
        type="button"
        onclick={() => consentStore.openCustomizeModal()}
        class="inline-flex shrink-0 cursor-pointer items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
        Manage cookies
      </button>
      <a
        href="/sitemap.xml"
        class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
        Sitemap
      </a>
      <a
        href="/atom.xml"
        class="inline-flex shrink-0 items-center transition-colors hover:text-text-primary focus-visible:text-text-primary focus-visible:outline-none">
        RSS
      </a>
    </div>
  </div>
</footer>
