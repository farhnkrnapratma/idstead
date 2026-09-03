<script lang="ts">
  import {getContext, tick} from 'svelte';
  import {GripVertical, X} from '@lucide/svelte';
  import type {FormFieldContext} from '../types';
  import {tryEscapeComma, splitEscapedCommas} from '../utils/pillParsing';
  import {cn} from '../utils/cn';

  interface Props {
    id: string;
    value: string[];
    itemLabel: string;
    placeholderEmpty?: string;
    placeholderFilled?: string;
    maxItems?: number;
    maxItemLength?: number;
    transformItem?: (item: string) => string;
    onPaste?: (e: ClipboardEvent) => void;
    variant?: 'standard' | 'floating';
    label?: string;
    required?: boolean;
    hideAsterisk?: boolean;
    class?: string;
  }

  let {
    id,
    value = $bindable(),
    itemLabel,
    placeholderEmpty = 'Type and press comma...',
    placeholderFilled = 'Add...',
    maxItems,
    maxItemLength,
    transformItem,
    onPaste,
    variant,
    label = '',
    required,
    hideAsterisk,
    class: className = ''
  }: Props = $props();

  let isFocused = $state(false);
  let inputElement = $state<HTMLInputElement | null>(null);
  let inputValue = $state('');
  let editingIdx = $state<number | null>(null);
  let editingText = $state('');
  let draggedIdx = $state<number | null>(null);

  const formCtx = getContext<FormFieldContext>('formField');
  const resolvedVariant = $derived(variant ?? formCtx?.variant ?? 'floating');
  const resolvedLabel = $derived(label || formCtx?.label || '');
  const resolvedRequired = $derived(required ?? formCtx?.required ?? false);
  const resolvedHideAsterisk = $derived(
    hideAsterisk ?? formCtx?.hideAsterisk ?? false
  );
  const isFloating = $derived(resolvedVariant === 'floating');
  const hasValue = $derived(
    value.length > 0 || inputValue.length > 0 || editingIdx !== null
  );
  const isFloatingActive = $derived(isFloating && (hasValue || isFocused));
  const atMax = $derived(maxItems !== undefined && value.length >= maxItems);
  const resolvedCounter = $derived(formCtx?.counter ?? '');

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function processItem(raw: string): string {
    let text = raw.trim();
    if (transformItem) {
      text = transformItem(text).trim();
    }
    return maxItemLength !== undefined ? text.slice(0, maxItemLength) : text;
  }

  function startEdit(idx: number, currentText: string) {
    editingIdx = idx;
    editingText = currentText;
  }

  function saveEdit(idx: number) {
    if (editingIdx === idx) {
      const processed = processItem(editingText);
      if (processed) {
        value[idx] = processed;
      }
      editingIdx = null;
      editingText = '';
    }
  }

  function addValue(raw: string) {
    if (atMax) return;
    const val = processItem(raw);
    if (val && !value.includes(val)) {
      value = [...value, val];
    }
  }

  function removeValue(idx: number) {
    value = value.filter((_, i) => i !== idx);
  }

  function createDragImage(sourceEl: HTMLElement): HTMLElement {
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    const rect = sourceEl.getBoundingClientRect();
    const computed = getComputedStyle(sourceEl);
    Object.assign(clone.style, {
      position: 'fixed',
      top: '-1000px',
      left: '-1000px',
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      borderRadius: computed.borderRadius,
      background: computed.backgroundColor,
      border: computed.border,
      pointerEvents: 'none'
    });
    document.body.appendChild(clone);
    return clone;
  }

  function handleDragStart(idx: number, e: DragEvent) {
    draggedIdx = idx;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
      const ghost = createDragImage(e.currentTarget as HTMLElement);
      e.dataTransfer.setDragImage(ghost, 12, 12);
      setTimeout(() => ghost.remove(), 0);
    }
  }

  function handleDrop(targetIdx: number, e: DragEvent) {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== targetIdx) {
      const next = [...value];
      const [removed] = next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, removed);
      value = next;
    }
    draggedIdx = null;
  }

  function handlePaste(e: ClipboardEvent) {
    if (onPaste) {
      onPaste(e);
      return;
    }
    const text = e.clipboardData?.getData('text/plain') ?? '';
    const toAdd = splitEscapedCommas(text);
    if (toAdd.length === 0) return;
    e.preventDefault();
    const merged = [...value];
    for (const item of toAdd) {
      if (maxItems !== undefined && merged.length >= maxItems) break;
      const processed = processItem(item);
      if (processed && !merged.includes(processed)) merged.push(processed);
    }
    value = merged;
    inputValue = '';
  }

  function fitPill(node: HTMLElement) {
    function update() {
      const textEl = node.querySelector<HTMLElement>('[data-pill-text]');
      if (!textEl) return;
      node.style.maxWidth = '';

      const range = document.createRange();
      range.selectNodeContents(textEl);
      const rects = range.getClientRects();

      if (rects.length > 1) {
        let maxLineWidth = 0;
        for (let i = 0; i < rects.length; i++) {
          const w = rects[i].width;
          if (w > maxLineWidth) maxLineWidth = w;
        }

        const gripEl = node.querySelector<HTMLElement>('[data-pill-grip]');
        const removeEl = node.querySelector<HTMLElement>('[data-pill-remove]');
        const gripWidth = gripEl ? gripEl.offsetWidth : 12;
        const removeWidth = removeEl ? removeEl.offsetWidth : 14;

        const style = window.getComputedStyle(node);
        const paddingLeft = parseFloat(style.paddingLeft) || 8;
        const paddingRight = parseFloat(style.paddingRight) || 8;
        const borderLeft = parseFloat(style.borderLeftWidth) || 1;
        const borderRight = parseFloat(style.borderRightWidth) || 1;

        const totalWidth = Math.ceil(
          maxLineWidth
            + gripWidth
            + removeWidth
            + paddingLeft
            + paddingRight
            + borderLeft
            + borderRight
            + 12
        );

        node.style.maxWidth = `${totalWidth}px`;
      }
    }

    requestAnimationFrame(update);

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });
    if (node.parentElement) {
      ro.observe(node.parentElement);
    }

    return {
      update() {
        requestAnimationFrame(update);
      },
      destroy() {
        ro.disconnect();
      }
    };
  }
</script>

<div
  onclick={e => {
    if (
      (e.target as HTMLElement).closest(
        '[data-pill-remove], [data-pill-text], input'
      )
    )
      return;
    inputElement?.focus();
  }}
  class={cn(
    'relative flex min-h-12 w-full flex-wrap gap-2 rounded-sm border border-border-subtle/50 bg-surface-card/85 px-3 shadow-2xs backdrop-blur-xs transition-colors focus-within:border-copilot focus-within:bg-surface-card focus-within:ring-2 focus-within:ring-copilot/20 focus-within:outline-none dark:border-white/10 dark:bg-surface-card/70 dark:focus-within:bg-surface-card/90',
    isFloating ? 'items-start pt-5! pb-1.5!' : 'items-center py-2',
    className
  )}>
  {#if isFloating && resolvedLabel}
    <label
      for={id}
      class={cn(
        'pointer-events-none absolute left-3 z-10 font-sans-title font-medium transition-all duration-200 select-none',
        isFloatingActive ?
          'top-1.5 text-2xs leading-none font-semibold '
            + (isFocused ? 'text-copilot' : 'text-text-muted')
        : 'top-3 text-sm text-text-secondary/70',
        formCtx?.error ? 'text-danger!' : ''
      )}>
      {resolvedLabel}
      {#if resolvedRequired && !resolvedHideAsterisk}
        <span
          class="text-danger"
          aria-hidden="true">*</span>
      {/if}
    </label>
  {/if}
  {#if isFloating && resolvedCounter && (hasValue || isFocused)}
    <span
      class="pointer-events-none absolute top-1.5 right-3 z-10 font-mono text-2xs leading-none text-text-muted select-none">
      {resolvedCounter}
    </span>
  {/if}
  {#each value as item, idx (item)}
    <span
      role="group"
      aria-label={`${itemLabel}: ${item}`}
      draggable="true"
      use:fitPill
      ondragstart={e => handleDragStart(idx, e)}
      ondragover={e => e.preventDefault()}
      ondrop={e => handleDrop(idx, e)}
      class="box-border inline-flex h-5 max-h-5 w-fit max-w-full items-center gap-1 rounded-full border border-copilot/30 bg-copilot/10 px-1.5 font-sans text-xs leading-none font-medium text-copilot transition-all hover:border-copilot/50">
      <span
        data-pill-grip
        class="inline-flex shrink-0 cursor-grab items-center justify-center text-copilot/60 transition-colors hover:text-copilot active:cursor-grabbing">
        <GripVertical class="size-2.5 -translate-y-[0.5px]" />
      </span>
      {#if editingIdx === idx}
        <input
          type="text"
          id={`${id}-edit-${idx}`}
          bind:value={editingText}
          maxlength={maxItemLength}
          style="--sk-w: {Math.max(editingText.length, 3)}ch"
          class="m-0 h-3.5 w-(--sk-w) appearance-none border-none bg-transparent p-0 font-sans text-xs leading-none font-medium text-copilot shadow-none ring-0 ring-offset-0 outline-none focus:border-none! focus:ring-0! focus:outline-none! focus-visible:border-none! focus-visible:ring-0! focus-visible:outline-none!"
          onkeydown={e => {
            const target = e.currentTarget as HTMLInputElement;
            if (e.key === ',') {
              e.preventDefault();
              const cursor = target.selectionStart ?? editingText.length;
              const escaped = tryEscapeComma(editingText, cursor);
              if (escaped) {
                editingText = escaped.value;
                tick().then(() =>
                  target.setSelectionRange(escaped.cursor, escaped.cursor)
                );
              } else {
                saveEdit(idx);
              }
            } else if (e.key === 'Enter') {
              e.preventDefault();
              saveEdit(idx);
            }
          }}
          onblur={() => saveEdit(idx)}
          use:focusOnMount />
      {:else}
        <span
          data-pill-text
          role="button"
          tabindex="0"
          class="inline-flex cursor-pointer items-center leading-none wrap-break-word hover:underline"
          onclick={() => startEdit(idx, item)}
          onkeydown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              startEdit(idx, item);
            }
          }}>
          {item}
        </span>
      {/if}
      <button
        data-pill-remove
        type="button"
        class="inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full p-0 text-copilot/60 transition-colors hover:bg-copilot/20 hover:text-copilot focus:outline-none active:text-copilot"
        aria-label="Remove {item}"
        onclick={() => removeValue(idx)}>
        <X class="size-2.5 -translate-y-[0.5px]" />
      </button>
    </span>
  {/each}
  {#if !atMax}
    <input
      bind:this={inputElement}
      {id}
      type="text"
      bind:value={inputValue}
      maxlength={maxItemLength}
      onfocus={() => (isFocused = true)}
      class="h-5 min-w-16 flex-1 appearance-none border-none bg-transparent p-0 font-sans text-sm leading-5 text-text-primary shadow-none ring-0 ring-offset-0 outline-none placeholder:text-text-muted/60 focus:border-none! focus:ring-0! focus:outline-none! focus-visible:border-none! focus-visible:ring-0! focus-visible:outline-none!"
      placeholder={isFloating ? ''
      : value.length === 0 ? placeholderEmpty
      : placeholderFilled}
      onkeydown={e => {
        if (e.key === ',') {
          e.preventDefault();
          const target = e.currentTarget as HTMLInputElement;
          const cursor = target.selectionStart ?? target.value.length;
          const escaped = tryEscapeComma(target.value, cursor);
          if (escaped) {
            inputValue = escaped.value;
            tick().then(() =>
              target.setSelectionRange(escaped.cursor, escaped.cursor)
            );
            return;
          }
          addValue(target.value);
          inputValue = '';
        } else if (e.key === 'Enter') {
          e.preventDefault();
          addValue(inputValue);
          inputValue = '';
        }
      }}
      onblur={() => {
        isFocused = false;
        addValue(inputValue);
        inputValue = '';
      }}
      onpaste={handlePaste} />
  {/if}
</div>
