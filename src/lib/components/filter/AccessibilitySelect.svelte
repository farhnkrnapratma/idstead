<script lang="ts">
  import {Accessibility} from '@lucide/svelte';
  import {cn} from '../../utils/cn';
  import IconButton from '../IconButton.svelte';
  import {a11yStore, type FontScale} from '../../stores/a11yStore.svelte';

  interface Props {
    class?: string;
    dropdownDirection?: 'up' | 'down';
  }

  let {class: className = '', dropdownDirection = 'down'}: Props = $props();

  let isOpen = $state(false);

  const fontScaleOptions: {
    value: FontScale;
    label: string;
    previewClass: string;
  }[] = [
    {value: 100, label: '100%', previewClass: 'text-xs'},
    {value: 110, label: '110%', previewClass: 'text-sm'},
    {value: 120, label: '120%', previewClass: 'text-base'},
    {value: 130, label: '130%', previewClass: 'text-lg'},
    {value: 140, label: '140%', previewClass: 'text-xl'},
    {value: 150, label: '150%', previewClass: 'text-2xl'}
  ];

  const toggles: {
    key:
      | 'reduceMotion'
      | 'solidSurfaces'
      | 'highContrast'
      | 'focusHighlight'
      | 'dyslexicFont';
    label: string;
    description: string;
    toggle: () => void;
  }[] = [
    {
      key: 'reduceMotion',
      label: 'Reduce motion',
      description: 'Stop animations and background motion',
      toggle: a11yStore.toggleReduceMotion
    },
    {
      key: 'solidSurfaces',
      label: 'Solid surfaces',
      description: 'Remove frosted-glass transparency',
      toggle: a11yStore.toggleSolidSurfaces
    },
    {
      key: 'highContrast',
      label: 'High contrast text',
      description: 'Increase text contrast ratios',
      toggle: a11yStore.toggleHighContrast
    },
    {
      key: 'focusHighlight',
      label: 'Focus ring highlight',
      description: 'High-visibility keyboard focus outline',
      toggle: a11yStore.toggleFocusHighlight
    },
    {
      key: 'dyslexicFont',
      label: 'Dyslexic-friendly font',
      description: 'Use a more legible font stack',
      toggle: a11yStore.toggleDyslexicFont
    }
  ];

  let containerRef: HTMLDivElement | undefined = $state();

  function close() {
    isOpen = false;
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (
      isOpen
      && containerRef
      && !containerRef.contains(event.target as Node)
    ) {
      close();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      close();
    }
  }
</script>

<svelte:window
  onpointerdown={handleWindowPointerDown}
  onkeydown={handleKeydown} />

<div
  class={cn(
    'items-center gap-2 select-none',
    isOpen ? 'z-60' : 'z-20',
    className.includes('hidden') ? className : `inline-flex ${className}`
  )}>
  <div
    bind:this={containerRef}
    class="relative inline-block">
    <IconButton
      ariaLabel="Accessibility"
      tooltip="Accessibility"
      tooltipPlacement={dropdownDirection === 'up' ? 'top' : 'bottom'}
      tooltipAlign="right"
      size="sm"
      aria-haspopup="true"
      aria-expanded={isOpen}
      onclick={() => (isOpen = !isOpen)}
      class={cn(
        'border-border-subtle bg-surface backdrop-blur-none hover:border-copilot hover:bg-surface-hover',
        isOpen && 'border-copilot text-copilot'
      )}>
      <Accessibility class="size-4" />
    </IconButton>

    {#if isOpen}
      <button
        type="button"
        class="fixed inset-0 z-65 cursor-default"
        onclick={close}
        aria-label="Close accessibility selector"></button>

      <div
        role="dialog"
        aria-labelledby="a11y-settings-heading"
        class={cn(
          'absolute right-0 z-70 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col rounded-sm glass-overlay p-4 shadow-xl',
          dropdownDirection === 'up' ?
            'bottom-[calc(100%+8px)]'
          : 'top-[calc(100%+8px)]'
        )}>
        <div class="relative z-10 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span
              id="a11y-settings-heading"
              class="text-xs font-bold tracking-tight text-text-primary">
              Accessibility
            </span>
            <button
              type="button"
              onclick={a11yStore.reset}
              class="cursor-pointer text-2xs font-medium text-text-secondary transition-colors hover:text-copilot">
              Reset
            </button>
          </div>

          <p class="text-3xs text-text-muted">
            Customize display preferences for improved accessibility.
          </p>

          <div
            class="flex flex-col gap-2"
            role="group"
            aria-labelledby="a11y-settings-heading">
            {#each toggles as item (item.key)}
              {@const checked = a11yStore.current[item.key]}
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-xs font-semibold text-text-primary">
                  {item.label}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label="{item.label}: {item.description}"
                  onclick={item.toggle}
                  class={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors',
                    checked ?
                      'border-copilot bg-copilot'
                    : 'border-border-default bg-surface'
                  )}>
                  <span
                    class={cn(
                      'inline-block h-3.5 w-3.5 rounded-full bg-text-on-accent shadow-xs transition-transform',
                      checked ? 'translate-x-4' : 'translate-x-0.5'
                    )}></span>
                </button>
              </div>
            {/each}
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <span
                class="text-xs font-semibold text-text-primary"
                id="a11y-font-scale-heading">
                Text size
              </span>
              <span class="text-2xs font-semibold text-copilot">
                {a11yStore.current.fontScale}%
              </span>
            </div>
            <div
              role="radiogroup"
              aria-labelledby="a11y-font-scale-heading"
              class="grid grid-cols-3 gap-1">
              {#each fontScaleOptions as option (option.value)}
                {@const selected = a11yStore.current.fontScale === option.value}
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  onclick={() => a11yStore.setFontScale(option.value)}
                  class={cn(
                    'flex cursor-pointer flex-col items-center gap-0.5 rounded-sm border py-1.5 transition-colors',
                    selected ?
                      'border-copilot bg-copilot/10 text-copilot'
                    : 'border-border-subtle bg-surface text-text-secondary hover:border-copilot/50 hover:text-copilot'
                  )}>
                  <span
                    class="{option.previewClass} leading-none font-bold"
                    aria-hidden="true">
                    Aa
                  </span>
                  <span class="text-3xs font-semibold">{option.label}</span>
                </button>
              {/each}
            </div>
          </div>

          <button
            type="button"
            onclick={a11yStore.reset}
            class="cursor-pointer self-start text-2xs font-semibold text-text-muted underline-offset-2 hover:text-copilot hover:underline">
            Reset to defaults
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
