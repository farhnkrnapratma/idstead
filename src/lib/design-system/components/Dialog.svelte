<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    isOpen: boolean
    title: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
    isDestructive?: boolean
    closeOnBackdrop?: boolean
    closeOnEscape?: boolean
    returnFocusToTrigger?: boolean
    onClose: () => void
    children?: Snippet
    footer?: Snippet
    class?: string
  }

  let {
    isOpen = $bindable(false),
    title,
    description = '',
    size = 'md',
    isDestructive = false,
    closeOnBackdrop = true,
    closeOnEscape = true,
    returnFocusToTrigger = true,
    onClose,
    children,
    footer,
    class: className = ''
  }: Props = $props()

  let dialogRef = $state<HTMLElement | null>(null)
  let previouslyFocusedElement = $state<HTMLElement | null>(null)

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return

    if (e.key === 'Escape' && closeOnEscape) {
      e.preventDefault()
      onClose()
      return
    }

    if (e.key === 'Tab' && dialogRef) {
      const focusables = dialogRef.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  $effect(() => {
    if (isOpen && typeof document !== 'undefined') {
      previouslyFocusedElement = document.activeElement as HTMLElement
      setTimeout(() => {
        const focusable = dialogRef?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable) {
          focusable.focus()
        } else if (dialogRef) {
          dialogRef.focus()
        }
      }, 30)
    } else if (!isOpen && previouslyFocusedElement && returnFocusToTrigger) {
      setTimeout(() => {
        previouslyFocusedElement?.focus()
        previouslyFocusedElement = null
      }, 30)
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <button
      type="button"
      class="absolute inset-0 cursor-default bg-overlay-backdrop backdrop-blur-sm"
      aria-label="Close modal"
      onclick={() => closeOnBackdrop && onClose()}
    ></button>

    <div
      bind:this={dialogRef}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-desc' : undefined}
      class={cn(
        'relative z-10 w-full transform rounded-2xl border border-border-subtle bg-surface-elevated p-6 shadow-2xl transition-all select-none focus:outline-none',
        sizeStyles[size],
        isDestructive ? 'border-danger/30' : '',
        className
      )}
    >
      <div class="flex flex-col gap-1 text-left">
        <h2
          id="dialog-title"
          class={cn(
            'flex items-center gap-2 text-base font-bold text-text-primary',
            isDestructive ? 'text-danger' : ''
          )}
        >
          {#if isDestructive}
            <i
              class="bi bi-exclamation-triangle-fill text-sm text-danger"
              aria-hidden="true"
            ></i>
          {/if}
          {title}
        </h2>
        {#if description}
          <p
            id="dialog-desc"
            class="mt-1 text-xs leading-relaxed text-text-secondary"
          >
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
        <div class="mt-6 flex items-center justify-end gap-3">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
