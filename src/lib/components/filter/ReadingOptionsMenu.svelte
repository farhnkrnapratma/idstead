<script lang="ts">
  import {buttonKey} from '#lib/shortcuts.ts';
  import {
    View,
    Circle,
    CircleDot,
    ToggleLeft,
    ToggleRight,
    CaseSensitive,
    PersonStanding,
    X
  } from '@lucide/svelte';
  import {cn} from '../../utils/cn';
  import {portal} from '../../utils/actions';
  import {lockScroll} from '../../utils/scroll';
  import IconButton from '../IconButton.svelte';
  import {
    contentFontStore,
    type ContentFont
  } from '../../stores/contentFontStore.svelte';
  import {
    a11yStore,
    A11Y_TOGGLES,
    type FontScale
  } from '../../stores/a11yStore.svelte';

  type TabId = 'font' | 'accessibility';

  interface Props {
    showFontSelect?: boolean;
    class?: string;
    dropdownDirection?: 'up' | 'down';
  }

  let {
    showFontSelect = false,
    class: className = '',
    dropdownDirection = 'down'
  }: Props = $props();

  const fontOptions: {value: ContentFont; label: string; fontClass: string}[] =
    [
      {value: 'sans', label: 'Sans serif', fontClass: 'font-sans'},
      {value: 'serif', label: 'Serif', fontClass: 'font-serif'},
      {value: 'mono', label: 'Monospace', fontClass: 'font-mono'}
    ];

  let isOpen = $state(false);
  let containerRef: HTMLDivElement | undefined = $state();
  let panelRef: HTMLDivElement | undefined = $state();
  let hoveredFont = $state<ContentFont | null>(null);

  const availableTabs = $derived.by(() => {
    const tabs: {id: TabId; label: string; icon: typeof CaseSensitive}[] = [];
    if (showFontSelect) {
      tabs.push({id: 'font', label: 'Font', icon: CaseSensitive});
    }
    tabs.push({id: 'accessibility', label: 'A11y', icon: PersonStanding});
    return tabs;
  });

  let activeTab = $state<TabId>('font');

  $effect(() => {
    if (!availableTabs.some(t => t.id === activeTab)) {
      activeTab = availableTabs[0]?.id ?? 'accessibility';
    }
  });

  const activePreviewFont = $derived(hoveredFont ?? contentFontStore.current);
  const previewFontClass = $derived(
    fontOptions.find(f => f.value === activePreviewFont)?.fontClass
      ?? 'font-sans'
  );

  function open() {
    isOpen = true;
  }

  function close() {
    isOpen = false;
    hoveredFont = null;
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (!isOpen) return;
    const target = event.target as Node;
    if (
      (containerRef && containerRef.contains(target))
      || (panelRef && panelRef.contains(target))
    ) {
      return;
    }
    close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      close();
    }
  }

  $effect(() => {
    if (isOpen) {
      const unlock = lockScroll();
      return () => {
        unlock();
      };
    }
  });

  $effect(() => {
    if (!isOpen) return;
    const handleScroll = (event: Event) => {
      const target = event.target as Node;
      if (panelRef && (panelRef === target || panelRef.contains(target))) {
        return;
      }
      close();
    };
    window.addEventListener('scroll', handleScroll, {
      capture: true,
      passive: true
    });
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  });

  const fontScales: FontScale[] = [100, 110, 120, 130, 140, 150];

  function decreaseFontScale() {
    const currentIdx = fontScales.indexOf(a11yStore.current.fontScale);
    if (currentIdx > 0) {
      a11yStore.setFontScale(fontScales[currentIdx - 1]);
    }
  }

  function increaseFontScale() {
    const currentIdx = fontScales.indexOf(a11yStore.current.fontScale);
    if (currentIdx < fontScales.length - 1) {
      a11yStore.setFontScale(fontScales[currentIdx + 1]);
    }
  }
</script>

<svelte:window
  onpointerdown={handleWindowPointerDown}
  onkeydown={handleKeydown} />

<div
  class={cn(
    'inline-flex items-center gap-2 select-none',
    isOpen ? 'z-60' : 'z-20',
    className
  )}>
  <div
    bind:this={containerRef}
    class="relative inline-block">
    <IconButton
      ariaLabel="Reading and display preferences"
      keyboardShortcut={buttonKey('readingOptions')}
      shortcutLabel="Reading options"
      tooltip="Reading options"
      tooltipPlacement={dropdownDirection === 'up' ? 'top' : 'bottom'}
      tooltipAlign="right"
      size="sm"
      aria-haspopup="true"
      aria-expanded={isOpen}
      onclick={toggle}
      class={cn(
        'border-border-subtle bg-surface backdrop-blur-none hover:border-accent hover:bg-surface-hover sm:h-9 sm:w-9',
        isOpen && 'border-accent text-accent'
      )}>
      <View class="size-4" />
    </IconButton>

    {#if isOpen}
      <button
        use:portal
        type="button"
        class="fixed inset-0 z-65 cursor-default touch-none overscroll-contain bg-overlay/50 backdrop-blur-xs"
        aria-label="Close reading options"
        onwheel={e => e.preventDefault()}
        ontouchmove={e => e.preventDefault()}
        onclick={close}></button>

      <div
        use:portal
        bind:this={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Reading and display preferences"
        class="fixed top-1/2 left-1/2 z-70 flex max-h-[calc(100dvh-3rem)] w-76 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 [touch-action:pan-y] flex-col gap-3 overflow-y-auto overscroll-contain popover-surface p-3.5 shadow-2xl">
        <div
          class="flex items-center justify-between border-b border-border-subtle/50 pb-2">
          <span class="text-xs font-bold text-text-primary"
            >Reading & Display</span>
          <button
            type="button"
            onclick={close}
            class="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
            aria-label="Close reading options">
            <X class="size-3.5" />
          </button>
        </div>

        {#if availableTabs.length > 1}
          <div
            role="tablist"
            aria-label="Reading options categories"
            class="grid grid-flow-col gap-1 rounded-md border border-border-subtle/40 bg-surface-hover/40 p-1 select-none">
            {#each availableTabs as tab (tab.id)}
              {@const active = activeTab === tab.id}
              <button
                type="button"
                role="tab"
                id="tab-{tab.id}"
                aria-selected={active}
                aria-controls="panel-{tab.id}"
                onclick={() => (activeTab = tab.id)}
                class={cn(
                  'flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all',
                  active ?
                    'bg-surface-card font-semibold text-accent shadow-2xs'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}>
                <tab.icon class="size-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            {/each}
          </div>
        {/if}

        <div class="grid grid-cols-1 grid-rows-1 items-start">
          {#if showFontSelect}
            <div
              id="panel-font"
              role="tabpanel"
              aria-labelledby="tab-font"
              aria-hidden={activeTab !== 'font'}
              class={cn(
                'col-start-1 row-start-1 flex flex-col gap-2.5 transition-opacity duration-150',
                activeTab === 'font' ? 'z-10 opacity-100' : (
                  'pointer-events-none invisible z-0 opacity-0'
                )
              )}>
              <div class="flex items-center justify-between gap-2">
                <span
                  class="text-2xs font-semibold tracking-wider text-text-muted uppercase">
                  Font
                </span>
                <button
                  type="button"
                  onclick={contentFontStore.reset}
                  aria-disabled={contentFontStore.locked}
                  class={cn(
                    'text-2xs font-semibold text-text-muted underline-offset-2',
                    contentFontStore.locked ?
                      'cursor-not-allowed opacity-50'
                    : 'cursor-pointer hover:text-accent hover:underline'
                  )}>
                  Reset to default
                </button>
              </div>

              {#if contentFontStore.locked}
                <p
                  id="reading-font-locked"
                  class="rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 text-2xs text-text-muted">
                  Locked while the dyslexic-friendly font is on.
                </p>
              {/if}

              <div
                class="flex flex-col gap-1"
                aria-describedby={contentFontStore.locked ?
                  'reading-font-locked'
                : undefined}>
                {#each fontOptions as opt (opt.value)}
                  {@const selected = contentFontStore.current === opt.value}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={contentFontStore.locked}
                    onclick={() => contentFontStore.setFont(opt.value)}
                    onmouseenter={() => (hoveredFont = opt.value)}
                    onmouseleave={() => (hoveredFont = null)}
                    class={cn(
                      'group flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                      contentFontStore.locked
                        && 'cursor-not-allowed opacity-50',
                      selected ?
                        'border-accent bg-accent/10 text-accent'
                      : cn(
                          'border-border-subtle bg-surface text-text-secondary',
                          !contentFontStore.locked
                            && 'hover:border-accent/50 hover:text-text-primary'
                        )
                    )}>
                    <span class={cn('font-medium', opt.fontClass)}>
                      {opt.label}
                    </span>
                    <span
                      class="relative flex size-3.5 shrink-0 items-center justify-center">
                      <Circle
                        class={cn(
                          'absolute size-3.5 transition-all duration-200',
                          selected ? 'scale-0 opacity-0' : (
                            'scale-100 text-text-muted opacity-100 group-hover:text-text-secondary'
                          )
                        )} />
                      <CircleDot
                        class={cn(
                          'absolute size-3.5 transition-all duration-200',
                          selected ?
                            'scale-100 text-accent opacity-100'
                          : 'scale-0 opacity-0'
                        )} />
                    </span>
                  </button>
                {/each}
              </div>

              <div class="flex flex-col gap-1">
                <span
                  class="text-2xs font-semibold tracking-wider text-text-muted uppercase">
                  Preview
                </span>
                <div
                  class="rounded-md border border-border-subtle bg-surface px-2.5 py-2">
                  <span
                    class={cn(
                      'text-xs wrap-break-word whitespace-normal text-text-secondary',
                      previewFontClass
                    )}>
                    Everyone has the right to freedom of thought, conscience and
                    religion.
                  </span>
                </div>
              </div>
            </div>
          {/if}

          <div
            id="panel-accessibility"
            role="tabpanel"
            aria-labelledby="tab-accessibility"
            aria-hidden={activeTab !== 'accessibility'}
            class={cn(
              'col-start-1 row-start-1 flex flex-col gap-2.5 transition-opacity duration-150',
              activeTab === 'accessibility' ? 'z-10 opacity-100' : (
                'pointer-events-none invisible z-0 opacity-0'
              )
            )}>
            <div class="flex items-center justify-between gap-2">
              <span
                class="text-2xs font-semibold tracking-wider text-text-muted uppercase">
                Accessibility
              </span>
              <button
                type="button"
                onclick={a11yStore.reset}
                class="cursor-pointer text-2xs font-semibold text-text-muted underline-offset-2 hover:text-accent hover:underline">
                Reset to default
              </button>
            </div>

            <div
              class="flex items-center justify-between rounded-md border border-border-subtle bg-surface-hover/50 px-2.5 py-1.5">
              <span class="text-xs text-text-secondary">Text size</span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={decreaseFontScale}
                  disabled={a11yStore.current.fontScale <= fontScales[0]}
                  class="flex size-6 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface text-xs font-bold text-text-primary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Decrease text size">
                  -
                </button>
                <span
                  class="min-w-8 text-center font-mono text-xs font-medium text-text-primary">
                  {a11yStore.current.fontScale}%
                </span>
                <button
                  type="button"
                  onclick={increaseFontScale}
                  disabled={a11yStore.current.fontScale
                    >= fontScales[fontScales.length - 1]}
                  class="flex size-6 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface text-xs font-bold text-text-primary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Increase text size">
                  +
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-1 pt-0.5">
              {#each A11Y_TOGGLES as item (item.key)}
                {@const checked = a11yStore.current[item.key]}
                <div
                  class="group/item flex items-center justify-between gap-2 py-0.5">
                  <span
                    class="text-xs font-normal text-text-secondary transition-colors group-hover/item:text-text-primary">
                    {item.label}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={item.label}
                    onclick={item.toggle}
                    class="relative flex h-6.5 w-7 shrink-0 cursor-pointer items-center justify-center">
                    <ToggleLeft
                      class={cn(
                        'absolute size-6.5 transition-[transform,opacity] duration-150',
                        checked ? 'scale-75 opacity-0' : (
                          'scale-100 text-text-muted opacity-100 group-hover/item:text-text-secondary'
                        )
                      )} />
                    <ToggleRight
                      class={cn(
                        'absolute size-6.5 transition-[transform,opacity] duration-150',
                        checked ?
                          'scale-100 text-accent opacity-100'
                        : 'scale-75 opacity-0'
                      )} />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
