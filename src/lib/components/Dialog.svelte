<script lang="ts">
  import type {Snippet} from 'svelte';
  import {AlertTriangle, X} from '@lucide/svelte';
  import {cn} from '../utils/cn';
  import {portal} from '../utils/actions';
  import {lockScroll} from '../utils/scroll';

  interface Props {
    isOpen: boolean;
    title: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    compact?: boolean;
    isDestructive?: boolean;
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    returnFocusToTrigger?: boolean;
    onClose: () => void;
    children?: Snippet;
    footer?: Snippet;
    class?: string;
  }

  let {
    isOpen = $bindable(false),
    title,
    description = '',
    size = 'md',
    compact = false,
    isDestructive = false,
    showCloseButton = true,
    closeOnBackdrop = true,
    closeOnEscape = true,
    returnFocusToTrigger = true,
    onClose,
    children,
    footer,
    class: className = ''
  }: Props = $props();

  let dialogRef = $state<HTMLElement | null>(null);
  let previouslyFocusedElement: HTMLElement | null = null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === 'Escape' && closeOnEscape) {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'Tab' && dialogRef) {
      const focusables = dialogRef.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (
        e.shiftKey
        && (document.activeElement === first
          || document.activeElement === dialogRef)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey
        && (document.activeElement === last
          || document.activeElement === dialogRef)
      ) {
        e.preventDefault();
        first.focus();
      }
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
    if (isOpen) {
      previouslyFocusedElement = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const initialInput = dialogRef?.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
        );
        if (initialInput) {
          initialInput.focus();
        } else if (dialogRef) {
          dialogRef.focus();
        }
      }, 30);
      return () => clearTimeout(timer);
    } else if (previouslyFocusedElement && returnFocusToTrigger) {
      const el = previouslyFocusedElement;
      previouslyFocusedElement = null;
      const timer = setTimeout(() => {
        el.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div
    use:portal
    class="fixed inset-0 z-100 flex items-center justify-center overscroll-contain p-4">
    <button
      type="button"
      class="fixed inset-0 cursor-default touch-none overscroll-contain bg-overlay/80 backdrop-blur-xs"
      aria-label="Close modal"
      onwheel={e => e.preventDefault()}
      ontouchmove={e => e.preventDefault()}
      onclick={() => closeOnBackdrop && onClose()}></button>

    <div
      bind:this={dialogRef}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-desc' : undefined}
      class={cn(
        'relative z-10 max-h-[calc(100dvh-2rem)] w-full transform overflow-y-auto overscroll-contain rounded-sm glass-overlay shadow-xl transition-all outline-none select-none focus:outline-none',
        compact ? 'p-5' : 'p-6',
        sizeStyles[size],
        isDestructive ? 'border-danger/30' : '',
        className
      )}>
      {#if showCloseButton}
        <button
          type="button"
          onclick={onClose}
          aria-label="Close dialog"
          class={cn(
            'absolute inline-flex size-6.5 cursor-pointer items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring',
            compact ? 'top-3.5 right-3.5' : 'top-4 right-4'
          )}>
          <X class="size-4" />
        </button>
      {/if}

      <div class="flex flex-col gap-1 pr-7 text-left">
        <h2
          id="dialog-title"
          class={cn(
            'flex items-center gap-2 font-sans-title text-base font-bold text-text-primary',
            isDestructive ? 'text-danger' : ''
          )}>
          {#if isDestructive}
            <AlertTriangle class="size-4 shrink-0 text-danger" />
          {/if}
          {title}
        </h2>
        {#if description}
          <p
            id="dialog-desc"
            class="mt-1 text-xs leading-relaxed text-text-secondary">
            {description}
          </p>
        {/if}
      </div>

      {#if children}
        <div class="mt-4">
          {@render children()}
        </div>
      {/if}

      {#if footer}
        <div
          class={cn(
            'flex items-center',
            compact ? 'mt-4 w-full gap-2.5' : 'mt-6 justify-end gap-3'
          )}>
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
