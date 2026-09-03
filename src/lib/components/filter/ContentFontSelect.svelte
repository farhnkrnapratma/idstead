<script lang="ts">
  import {CaseSensitive, Circle, CircleDot} from '@lucide/svelte';
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
  let hoveredFont = $state<ContentFont | null>(null);

  const fontOptions: {value: ContentFont; label: string; fontClass: string}[] =
    [
      {value: 'sans', label: 'Sans Serif', fontClass: 'font-sans'},
      {value: 'serif', label: 'Serif', fontClass: 'font-serif'},
      {value: 'mono', label: 'Monospace', fontClass: 'font-mono'}
    ];

  const previewFontClass = $derived(
    fontOptions.find(o => o.value === (hoveredFont ?? contentFontStore.current))
      ?.fontClass ?? 'font-sans'
  );

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
      ariaLabel="Reading Font"
      tooltip="Reading Font"
      tooltipPlacement={dropdownDirection === 'up' ? 'top' : 'bottom'}
      tooltipAlign="right"
      size="sm"
      aria-haspopup="true"
      aria-expanded={isOpen}
      onclick={() => (isOpen = !isOpen)}
      class={cn(
        'border-border-subtle bg-surface backdrop-blur-none hover:border-copilot hover:bg-surface-hover sm:h-9 sm:w-9',
        isOpen && 'border-copilot text-copilot'
      )}>
      <CaseSensitive class="size-4" />
    </IconButton>

    {#if isOpen}
      <button
        type="button"
        class="fixed inset-0 z-65 cursor-default"
        onclick={close}
        aria-label="Close reading font settings"></button>

      <div
        class={cn(
          'absolute z-70 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col gap-2.5 popover-surface p-3',
          dropdownDirection === 'up' ?
            'bottom-[calc(100%+8px)] left-0 sm:right-0 sm:left-auto'
          : 'top-[calc(100%+8px)] right-0'
        )}>
        <div class="relative z-10 flex flex-col gap-2.5">
          <div class="flex items-center justify-between gap-2">
            <p
              class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
              id="content-font-heading">
              Reading Font
            </p>
            <button
              type="button"
              onclick={contentFontStore.reset}
              class="cursor-pointer text-2xs font-semibold text-text-muted underline-offset-2 hover:text-copilot hover:underline">
              Reset to default
            </button>
          </div>

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
                onmouseenter={() => (hoveredFont = option.value)}
                onmouseleave={() => (hoveredFont = null)}
                class={cn(
                  'group flex cursor-pointer items-center justify-between gap-2.5 rounded-sm border px-2.5 py-2 text-left transition-colors',
                  selected ?
                    'border-copilot bg-copilot/10 text-copilot'
                  : 'border-border-subtle bg-surface text-text-secondary hover:border-copilot/50 hover:text-text-primary'
                )}>
                <span class={cn('text-xs font-medium', option.fontClass)}>
                  {option.label}
                </span>
                <span
                  class="relative flex size-4 shrink-0 items-center justify-center">
                  <Circle
                    class={cn(
                      'absolute size-4 transition-all duration-200',
                      selected ? 'scale-0 opacity-0' : (
                        'scale-100 text-text-muted opacity-100 group-hover:text-text-secondary'
                      )
                    )} />
                  <CircleDot
                    class={cn(
                      'absolute size-4 transition-all duration-200',
                      selected ?
                        'scale-100 text-copilot opacity-100'
                      : 'scale-0 opacity-0'
                    )} />
                </span>
              </button>
            {/each}
          </div>

          <div class="flex flex-col gap-1.5">
            <p
              class="text-2xs font-semibold tracking-wider text-text-muted uppercase">
              Preview
            </p>
            <div
              class="rounded-sm border border-border-subtle bg-surface px-2.5 py-2">
              <span
                class={cn(
                  'text-xs wrap-break-word whitespace-normal',
                  previewFontClass
                )}>
                Everyone has the right to freedom of thought, conscience and
                religion; this right includes freedom to change his religion or
                belief, and freedom, either alone or in community with others
                and in public or private, to manifest his religion or belief in
                teaching, practice, worship and observance.
              </span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
