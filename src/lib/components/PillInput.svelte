<script lang="ts">
  import {tick} from 'svelte'
  import {GripHorizontal, X} from '@lucide/svelte'
  import {tryEscapeComma, splitEscapedCommas} from '../utils/pillParsing'

  interface Props {
    id: string
    value: string[]
    itemLabel: string
    placeholderEmpty: string
    placeholderFilled: string
    maxItems?: number
    maxItemLength?: number
    onPaste?: (e: ClipboardEvent) => void
  }

  let {
    id,
    value = $bindable(),
    itemLabel,
    placeholderEmpty,
    placeholderFilled,
    maxItems,
    maxItemLength,
    onPaste
  }: Props = $props()

  let editingIdx = $state<number | null>(null)
  let editingText = $state('')
  let draggedIdx = $state<number | null>(null)

  const atMax = $derived(maxItems !== undefined && value.length >= maxItems)

  function focusOnMount(node: HTMLElement) {
    node.focus()
  }

  function clampLength(text: string): string {
    return maxItemLength !== undefined ? text.slice(0, maxItemLength) : text
  }

  function startEdit(idx: number, currentText: string) {
    editingIdx = idx
    editingText = currentText
  }

  function saveEdit(idx: number) {
    if (editingIdx === idx) {
      const trimmed = editingText.trim()
      if (trimmed) {
        value[idx] = clampLength(trimmed)
      }
      editingIdx = null
      editingText = ''
    }
  }

  function addValue(raw: string) {
    if (atMax) return
    const val = clampLength(raw.trim())
    if (val && !value.includes(val)) {
      value = [...value, val]
    }
  }

  function removeValue(idx: number) {
    value = value.filter((_, i) => i !== idx)
  }

  function createDragImage(sourceEl: HTMLElement): HTMLElement {
    const clone = sourceEl.cloneNode(true) as HTMLElement
    const rect = sourceEl.getBoundingClientRect()
    const computed = getComputedStyle(sourceEl)
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
    })
    document.body.appendChild(clone)
    return clone
  }

  function handleDragStart(idx: number, e: DragEvent) {
    draggedIdx = idx
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(idx))
      const ghost = createDragImage(e.currentTarget as HTMLElement)
      e.dataTransfer.setDragImage(ghost, 12, 12)
      setTimeout(() => ghost.remove(), 0)
    }
  }

  function handleDrop(targetIdx: number, e: DragEvent) {
    e.preventDefault()
    if (draggedIdx !== null && draggedIdx !== targetIdx) {
      const next = [...value]
      const [removed] = next.splice(draggedIdx, 1)
      next.splice(targetIdx, 0, removed)
      value = next
    }
    draggedIdx = null
  }

  function handlePaste(e: ClipboardEvent) {
    if (onPaste) {
      onPaste(e)
      return
    }
    const text = e.clipboardData?.getData('text/plain') ?? ''
    const toAdd = splitEscapedCommas(text)
    if (toAdd.length === 0) return
    e.preventDefault()
    const merged = [...value]
    for (const item of toAdd) {
      if (maxItems !== undefined && merged.length >= maxItems) break
      const clamped = clampLength(item)
      if (clamped && !merged.includes(clamped)) merged.push(clamped)
    }
    value = merged
    ;(e.currentTarget as HTMLInputElement).value = ''
  }
</script>

<div
  class="flex min-h-10 flex-wrap items-center gap-2 rounded-sm border border-border-subtle bg-surface-base p-2 focus-within:border-copilot focus-within:ring-2 focus-within:ring-copilot/20 focus-within:outline-none">
  {#each value as item, idx (idx)}
    <span
      role="group"
      aria-label={`${itemLabel}: ${item}`}
      draggable="true"
      ondragstart={e => handleDragStart(idx, e)}
      ondragover={e => e.preventDefault()}
      ondrop={e => handleDrop(idx, e)}
      class="box-border inline-flex h-6.5 items-center gap-1 rounded-full border border-copilot/30 bg-copilot/10 px-2 font-mono text-xs font-medium text-copilot transition-all hover:border-copilot/50">
      <span
        class="inline-flex cursor-grab items-center text-copilot/60 hover:text-copilot active:cursor-grabbing">
        <GripHorizontal class="size-3" />
      </span>
      {#if editingIdx === idx}
        <input
          type="text"
          id={`${id}-edit-${idx}`}
          bind:value={editingText}
          maxlength={maxItemLength}
          style="--sk-w: {Math.max(editingText.length, 3)}ch"
          class="m-0 h-4 w-(--sk-w) appearance-none border-none bg-transparent p-0 font-mono text-xs leading-none font-medium text-copilot shadow-none ring-0 ring-offset-0 outline-none focus:border-none! focus:ring-0! focus:outline-none! focus-visible:border-none! focus-visible:ring-0! focus-visible:outline-none!"
          onkeydown={e => {
            const target = e.currentTarget as HTMLInputElement
            if (e.key === ',') {
              e.preventDefault()
              const cursor = target.selectionStart ?? editingText.length
              const escaped = tryEscapeComma(editingText, cursor)
              if (escaped) {
                editingText = escaped.value
                tick().then(() =>
                  target.setSelectionRange(escaped.cursor, escaped.cursor)
                )
              } else {
                saveEdit(idx)
              }
            } else if (e.key === 'Enter') {
              e.preventDefault()
              saveEdit(idx)
            }
          }}
          onblur={() => saveEdit(idx)}
          use:focusOnMount />
      {:else}
        <span
          role="button"
          tabindex="0"
          class="inline-flex cursor-pointer items-center leading-none hover:underline"
          onclick={() => startEdit(idx, item)}
          onkeydown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              startEdit(idx, item)
            }
          }}>
          {item}
        </span>
      {/if}
      <button
        type="button"
        class="ml-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-copilot hover:bg-copilot/20 focus:outline-none"
        aria-label="Remove {item}"
        onclick={() => removeValue(idx)}>
        <X class="size-3" />
      </button>
    </span>
  {/each}
  {#if !atMax}
    <input
      {id}
      type="text"
      maxlength={maxItemLength}
      class="h-6.5 min-w-35 flex-1 appearance-none border-none bg-transparent p-0 font-mono text-xs leading-none text-text-primary shadow-none ring-0 ring-offset-0 outline-none placeholder:text-text-muted focus:border-none! focus:ring-0! focus:outline-none! focus-visible:border-none! focus-visible:ring-0! focus-visible:outline-none!"
      placeholder={value.length === 0 ? placeholderEmpty : placeholderFilled}
      onkeydown={e => {
        if (e.key === ',') {
          e.preventDefault()
          const target = e.currentTarget as HTMLInputElement
          const cursor = target.selectionStart ?? target.value.length
          const escaped = tryEscapeComma(target.value, cursor)
          if (escaped) {
            target.value = escaped.value
            target.setSelectionRange(escaped.cursor, escaped.cursor)
            return
          }
          addValue(target.value)
          target.value = ''
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const target = e.currentTarget as HTMLInputElement
          addValue(target.value)
          target.value = ''
        }
      }}
      onblur={e => {
        const target = e.currentTarget as HTMLInputElement
        addValue(target.value)
        target.value = ''
      }}
      onpaste={handlePaste} />
  {/if}
</div>
