<script lang="ts">
  import type {Snippet} from 'svelte';
  import {fade} from 'svelte/transition';
  import {portal} from '../utils/actions';
  import {cn} from '../utils/cn';

  interface Props {
    content?: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'center' | 'left' | 'right' | 'start' | 'end';
    delay?: number;
    offset?: number;
    disabled?: boolean;
    class?: string;
    wrapperClass?: string;
    children?: Snippet;
    tooltipSnippet?: Snippet;
  }

  let {
    content,
    placement = 'bottom',
    align = 'center',
    delay = 150,
    offset = 6,
    disabled = false,
    class: className = '',
    wrapperClass = '',
    children,
    tooltipSnippet
  }: Props = $props();

  let isOpen = $state(false);
  let triggerEl = $state<HTMLElement | null>(null);
  let tooltipEl = $state<HTMLElement | null>(null);
  let coords = $state({top: 0, left: 0});
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isPointerTouch = false;

  function updatePosition() {
    if (!triggerEl || !tooltipEl) return;
    const triggerRect = triggerEl.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const margin = 8;
    const gap = offset;

    let targetPlacement = placement;

    if (
      placement === 'bottom'
      && triggerRect.bottom + gap + tooltipRect.height
        > window.innerHeight - margin
    ) {
      if (triggerRect.top - gap - tooltipRect.height > margin) {
        targetPlacement = 'top';
      }
    } else if (
      placement === 'top'
      && triggerRect.top - gap - tooltipRect.height < margin
    ) {
      if (
        triggerRect.bottom + gap + tooltipRect.height
        < window.innerHeight - margin
      ) {
        targetPlacement = 'bottom';
      }
    } else if (
      placement === 'left'
      && triggerRect.left - gap - tooltipRect.width < margin
    ) {
      if (
        triggerRect.right + gap + tooltipRect.width
        < window.innerWidth - margin
      ) {
        targetPlacement = 'right';
      }
    } else if (
      placement === 'right'
      && triggerRect.right + gap + tooltipRect.width
        > window.innerWidth - margin
    ) {
      if (triggerRect.left - gap - tooltipRect.width > margin) {
        targetPlacement = 'left';
      }
    }

    let top = 0;
    let left = 0;

    if (targetPlacement === 'top') {
      top = triggerRect.top - tooltipRect.height - gap;
    } else if (targetPlacement === 'bottom') {
      top = triggerRect.bottom + gap;
    } else if (targetPlacement === 'left') {
      left = triggerRect.left - tooltipRect.width - gap;
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
    } else if (targetPlacement === 'right') {
      left = triggerRect.right + gap;
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
    }

    if (targetPlacement === 'top' || targetPlacement === 'bottom') {
      if (align === 'left' || align === 'start') {
        left = triggerRect.left;
      } else if (align === 'right' || align === 'end') {
        left = triggerRect.right - tooltipRect.width;
      } else {
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      }
    }

    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - tooltipRect.width - margin)
    );
    top = Math.max(
      margin,
      Math.min(top, window.innerHeight - tooltipRect.height - margin)
    );

    coords = {top, left};
  }

  function show() {
    if (disabled || (!content && !tooltipSnippet)) return;
    if (timer) clearTimeout(timer);
    if (delay > 0) {
      timer = setTimeout(() => {
        isOpen = true;
      }, delay);
    } else {
      isOpen = true;
    }
  }

  function hide() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    isOpen = false;
  }

  function handlePointerEnter(e: PointerEvent) {
    if (e.pointerType === 'touch') {
      isPointerTouch = true;
      return;
    }
    isPointerTouch = false;
    show();
  }

  function handlePointerLeave(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    hide();
  }

  function handleFocusIn() {
    if (isPointerTouch) return;
    show();
  }

  function handleFocusOut() {
    hide();
  }

  function handleClick() {
    hide();
  }

  function initTooltip(node: HTMLElement) {
    tooltipEl = node;
    updatePosition();
    return {
      destroy() {
        if (tooltipEl === node) {
          tooltipEl = null;
        }
      }
    };
  }

  $effect(() => {
    if (isOpen) {
      updatePosition();
      const onKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          hide();
        }
      };
      const onScrollOrResize = () => {
        updatePosition();
      };
      window.addEventListener('keydown', onKeydown);
      window.addEventListener('scroll', onScrollOrResize, true);
      window.addEventListener('resize', onScrollOrResize);

      return () => {
        window.removeEventListener('keydown', onKeydown);
        window.removeEventListener('scroll', onScrollOrResize, true);
        window.removeEventListener('resize', onScrollOrResize);
      };
    }
  });

  $effect(() => {
    return () => {
      if (timer) clearTimeout(timer);
    };
  });
</script>

<div
  bind:this={triggerEl}
  class={cn('inline-flex', wrapperClass)}
  onpointerenter={handlePointerEnter}
  onpointerleave={handlePointerLeave}
  onfocusin={handleFocusIn}
  onfocusout={handleFocusOut}
  onclick={handleClick}
  onkeydown={e => {
    if (e.key === 'Enter' || e.key === ' ') handleClick();
  }}
  role="button"
  tabindex="-1">
  {@render children?.()}
</div>

{#if isOpen && !disabled && (content || tooltipSnippet)}
  <div
    use:portal
    use:initTooltip
    role="tooltip"
    style="top: {coords.top}px; left: {coords.left}px;"
    class={cn(
      'pointer-events-none fixed z-70 rounded-md glass-overlay px-2 py-1 text-3xs font-medium whitespace-nowrap text-text-primary shadow-lg',
      className
    )}
    transition:fade={{duration: 100}}>
    {#if tooltipSnippet}
      {@render tooltipSnippet()}
    {:else}
      <span class="relative z-10">{content}</span>
    {/if}
  </div>
{/if}
