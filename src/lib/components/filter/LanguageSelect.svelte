<script lang="ts">
  import {Languages, Circle, CircleDot} from '@lucide/svelte';
  import {cn} from '../../utils/cn';
  import IconButton from '../IconButton.svelte';

  interface Props {
    slug: string;
    currentLanguage: string;
    availableLocales: string[];
    class?: string;
    dropdownDirection?: 'up' | 'down';
  }

  let {
    slug,
    currentLanguage,
    availableLocales,
    class: className = '',
    dropdownDirection = 'down'
  }: Props = $props();

  const LANGUAGE_LABELS: Record<string, string> = {
    en: 'English',
    id: 'Bahasa Indonesia',
    ja: '日本語',
    zh: '简体中文',
    ko: '한국어'
  };

  let isOpen = $state(false);
  const languageOptions = $derived(['en', ...availableLocales]);

  function hrefForLang(lang: string): string {
    return lang === 'en' ? `/blog/${slug}` : `/blog/${slug}?lang=${lang}`;
  }

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
      ariaLabel="Translate"
      tooltip="Translate"
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
      <Languages class="size-4" />
    </IconButton>

    {#if isOpen}
      <button
        type="button"
        class="fixed inset-0 z-65 cursor-default"
        onclick={close}
        aria-label="Close language selector"></button>

      <div
        class={cn(
          'absolute right-0 z-70 flex w-64 max-w-[calc(100vw-1.5rem)] flex-col gap-2.5 popover-surface p-3',
          dropdownDirection === 'up' ?
            'bottom-[calc(100%+8px)]'
          : 'top-[calc(100%+8px)]'
        )}>
        <div class="relative z-10 flex flex-col gap-2.5">
          <div class="flex items-center justify-between gap-2">
            <p
              class="text-2xs font-semibold tracking-wider text-text-muted uppercase"
              id="language-select-heading">
              Translate
            </p>
            <a
              href={hrefForLang('en')}
              onclick={close}
              class="cursor-pointer text-2xs font-semibold text-text-muted underline-offset-2 hover:text-copilot hover:underline">
              Reset to default
            </a>
          </div>

          <div
            class="flex flex-col gap-1.5"
            role="radiogroup"
            aria-labelledby="language-select-heading">
            {#each languageOptions as loc (loc)}
              {@const selected = loc === currentLanguage}
              <a
                href={hrefForLang(loc)}
                role="radio"
                aria-checked={selected}
                onclick={close}
                class={cn(
                  'group flex items-center justify-between gap-2.5 rounded-sm border px-2.5 py-2 text-left transition-colors',
                  selected ?
                    'border-copilot bg-copilot/10 text-copilot'
                  : 'border-border-subtle bg-surface text-text-secondary hover:border-copilot/50 hover:text-text-primary'
                )}>
                <span class="text-xs font-medium">
                  {LANGUAGE_LABELS[loc] ?? loc}
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
              </a>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
