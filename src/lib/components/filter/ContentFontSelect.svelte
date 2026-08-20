<script lang="ts">
  import {CaseSensitive} from '@lucide/svelte';
  import {cn} from '../../utils/cn';
  import IconButton from '../IconButton.svelte';
  import {
    contentFontStore,
    type ContentFont
  } from '../../stores/contentFontStore.svelte';

  interface Props {
    class?: string;
    dropdownDirection?: 'up' | 'down';
  }

  let {class: className = '', dropdownDirection = 'down'}: Props = $props();

  let isOpen = $state(false);

  const fontOptions: {value: ContentFont; label: string; fontClass: string}[] =
    [
      {
        value: 'sans',
        label: 'Sans Serif (Google Sans)',
        fontClass: 'font-sans'
      },
      {
        value: 'serif',
        label: 'Serif (New Computer Modern)',
        fontClass: 'font-serif'
      },
      {value: 'mono', label: 'Mono (Google Sans Code)', fontClass: 'font-mono'}
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
      ariaLabel="Content Font"
      tooltip="Content Font"
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
      <CaseSensitive class="size-4" />
    </IconButton>

    {#if isOpen}
      <button
        type="button"
        class="fixed inset-0 z-65 cursor-default"
        onclick={close}
        aria-label="Close content font settings"></button>

      <div
        class={cn(
          'absolute right-0 z-70 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col gap-2.5 rounded-sm glass-overlay p-3 shadow-xl',
          dropdownDirection === 'up' ?
            'bottom-[calc(100%+8px)]'
          : 'top-[calc(100%+8px)]'
        )}>
        <div class="relative z-10 flex flex-col gap-2.5">
          <p
            class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
            id="content-font-heading">
            Content Font
          </p>

          <div
            class="flex flex-col gap-1.5"
            role="radiogroup"
            aria-labelledby="content-font-heading">
            {#each fontOptions as option (option.value)}
              {@const selected = contentFontStore.current === option.value}
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onclick={() => contentFontStore.setFont(option.value)}
                class={cn(
                  'flex cursor-pointer items-center justify-between gap-2.5 rounded-sm border px-2.5 py-2 text-left transition-colors',
                  selected ?
                    'border-copilot bg-copilot/10 text-copilot'
                  : 'border-border-subtle bg-surface text-text-secondary hover:border-copilot/50 hover:text-text-primary'
                )}>
                <span class={cn('text-xs font-medium', option.fontClass)}>
                  {option.label}
                </span>
                <span
                  class={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    selected ?
                      'border-copilot bg-copilot'
                    : 'border-border-default bg-surface'
                  )}>
                  {#if selected}
                    <span class="size-1.5 rounded-full bg-text-on-accent"
                    ></span>
                  {/if}
                </span>
              </button>
            {/each}
          </div>

          <button
            type="button"
            onclick={contentFontStore.reset}
            class="cursor-pointer self-start text-2xs font-semibold text-text-muted underline-offset-2 hover:text-copilot hover:underline">
            Reset to default
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
