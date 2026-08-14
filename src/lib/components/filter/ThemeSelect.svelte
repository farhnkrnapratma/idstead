<!-- @format -->
<script lang="ts">
  import {cn} from '../../utils/cn'
  import IconButton from '../IconButton.svelte'

  type Theme = 'auto' | 'dark' | 'light'

  interface Props {
    label?: string
    theme: Theme
    onThemeChange: (newTheme: Theme) => void
    class?: string
    dropdownDirection?: 'up' | 'down'
  }

  let {
    label,
    theme = 'auto',
    onThemeChange,
    class: className = '',
    dropdownDirection = 'down'
  }: Props = $props()

  let isOpen = $state(false)

  const themeOptions: {value: Theme; label: string; icon: string}[] = [
    {value: 'auto', label: 'Auto', icon: 'bi-circle-half'},
    {value: 'light', label: 'Light', icon: 'bi-sun-fill'},
    {value: 'dark', label: 'Dark', icon: 'bi-moon-stars-fill'}
  ]

  let currentOption = $derived(
    themeOptions.find(o => o.value === theme) ?? themeOptions[0]
  )

  function selectTheme(value: Theme) {
    onThemeChange(value)
    isOpen = false
  }
</script>

<div
  class={cn(
    'items-center gap-2 select-none',
    isOpen ? 'z-60' : 'z-20',
    className.includes('hidden') ? className : `inline-flex ${className}`
  )}>
  {#if label}
    <span class="text-xs font-medium whitespace-nowrap text-text-secondary"
      >{label}</span>
  {/if}

  <div class="relative inline-block">
    <IconButton
      ariaLabel="{label ? `${label}: ` : ''}{currentOption.label}"
      size="sm"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      onclick={() => (isOpen = !isOpen)}
      class={cn(
        'border-border-subtle bg-surface backdrop-blur-none hover:border-copilot hover:bg-surface-hover',
        isOpen && 'border-copilot text-copilot'
      )}>
      <i
        class="bi {currentOption.icon} text-sm"
        aria-hidden="true"></i>
    </IconButton>

    {#if isOpen}
      <button
        type="button"
        class="fixed inset-0 z-65 cursor-default"
        onclick={() => (isOpen = false)}
        aria-label="Close {label ?? 'theme'} selector"></button>

      <div
        role="listbox"
        aria-label="{label ?? 'Theme'} options"
        class={cn(
          'absolute left-1/2 z-70 flex w-full w-max min-w-full -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl',
          dropdownDirection === 'up' ?
            'bottom-[calc(100%+8px)]'
          : 'top-[calc(100%+8px)]'
        )}>
        <div class="relative z-10 flex flex-col overflow-hidden rounded-sm">
          {#each themeOptions as option (option.value)}
            <button
              type="button"
              role="option"
              aria-selected={theme === option.value}
              onclick={() => selectTheme(option.value)}
              class={cn(
                'flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium transition-colors',
                theme === option.value ?
                  'bg-copilot/10 font-semibold text-copilot'
                : 'text-text-primary hover:bg-surface-hover hover:text-copilot'
              )}>
              <span class="inline-flex min-w-0 items-center gap-1.5 truncate">
                <i
                  class="bi {option.icon} shrink-0 text-xs {(
                    theme === option.value
                  ) ?
                    'text-copilot'
                  : 'text-text-secondary'}"
                  aria-hidden="true"></i>
                <span class="truncate">{option.label}</span>
              </span>
              {#if theme === option.value}
                <i
                  class="bi bi-check2 shrink-0 text-sm text-copilot"
                  aria-hidden="true"></i>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
