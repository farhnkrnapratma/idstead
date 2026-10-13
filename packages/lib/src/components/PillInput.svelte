<script lang="ts">
    import { getContext, tick } from 'svelte';
    import { GripVertical, X } from '@lucide/svelte';
    import type { FormFieldContext } from '../types';
    import { tryEscapeComma, splitEscapedCommas } from '../utils/pillParsing';
    import { cn } from '../utils/cn';

    interface Props {
        id: string;
        value: string[];
        itemLabel: string;
        placeholderEmpty?: string;
        placeholderFilled?: string;
        maxItems?: number;
        maxItemLength?: number;
        transformItem?: (item: string) => string;
        onblur?: () => void;
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
        onblur,
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
    const resolvedHideAsterisk = $derived(hideAsterisk ?? formCtx?.hideAsterisk ?? false);
    const isFloating = $derived(resolvedVariant === 'floating');
    const hasValue = $derived(value.length > 0 || inputValue.length > 0 || editingIdx !== null);
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
</script>

<div
    role="presentation"
    onclick={e => {
        if ((e.target as HTMLElement).closest('[data-pill-remove], [data-pill-text], input'))
            return;
        inputElement?.focus();
    }}
    class={cn(
        'relative flex min-h-12 w-full flex-wrap gap-2 rounded-md border border-border-subtle/50 bg-surface-card/85 px-3 shadow-2xs backdrop-blur-xs transition-colors focus-within:border-accent focus-within:bg-surface-card focus-within:ring-2 focus-within:ring-accent/20 focus-within:outline-none dark:border-white/10 dark:bg-surface-card/70 dark:focus-within:bg-surface-card/90',
        isFloating ? 'items-start pt-5! pb-1.5!' : 'items-center py-2',
        className
    )}>
    {#if isFloating && resolvedLabel}
        <label
            for={id}
            class={cn(
                'pointer-events-none absolute left-3 z-10 font-medium transition-all duration-200 select-none',
                isFloatingActive ?
                    'top-1.5 text-2xs leading-none font-semibold '
                        + (isFocused ? 'text-accent-text' : 'text-text-muted')
                :   'top-3 text-sm text-text-secondary/70',
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
            ondragstart={e => handleDragStart(idx, e)}
            ondragover={e => e.preventDefault()}
            ondrop={e => handleDrop(idx, e)}
            class="box-border inline-flex h-auto min-h-5 w-fit max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-sans text-xs leading-tight font-medium text-accent-text transition-all hover:border-accent/50">
            <span
                data-pill-grip
                aria-hidden="true"
                class="inline-flex shrink-0 cursor-grab items-center justify-center text-accent/60 transition-colors hover:text-accent-text active:cursor-grabbing">
                <GripVertical class="size-2.5" />
            </span>
            {#if editingIdx === idx}
                <input
                    type="text"
                    id={`${id}-edit-${idx}`}
                    aria-label="Edit {itemLabel}: {item}"
                    bind:value={editingText}
                    maxlength={maxItemLength}
                    style="--sk-w: {Math.max(editingText.length, 3)}ch"
                    class="m-0 h-3.5 w-(--sk-w) appearance-none border-none bg-transparent p-0 font-sans text-xs leading-none font-medium text-accent-text shadow-none ring-0 ring-offset-0 outline-none focus:border-none! focus:ring-0! focus:outline-none! focus-visible:border-none! focus-visible:ring-0! focus-visible:outline-none!"
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
                    onblur={() => {
                        saveEdit(idx);
                        onblur?.();
                    }}
                    use:focusOnMount />
            {:else}
                <span
                    data-pill-text
                    role="button"
                    tabindex="0"
                    class="inline-flex cursor-pointer items-center leading-tight wrap-break-word whitespace-normal hover:underline"
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
                class="relative inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full p-0 text-accent-text transition-colors after:absolute after:top-1/2 after:left-1/2 after:size-6 after:-translate-1/2 after:rounded-full hover:bg-accent/20 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring pointer-coarse:after:size-9"
                aria-label="Remove {item}"
                onclick={() => removeValue(idx)}>
                <X class="size-2.5" />
            </button>
        </span>
    {/each}
    {#if !atMax}
        <input
            bind:this={inputElement}
            {id}
            type="text"
            aria-invalid={formCtx?.error ? 'true' : undefined}
            bind:value={inputValue}
            maxlength={maxItemLength}
            onfocus={() => (isFocused = true)}
            class="h-5 min-w-10 flex-1 shrink appearance-none border-none bg-transparent p-0 font-sans text-sm leading-5 text-text-primary shadow-none ring-0 ring-offset-0 outline-none placeholder:text-text-muted/60 focus:border-none! focus:ring-0! focus:outline-none! focus-visible:border-none! focus-visible:ring-0! focus-visible:outline-none!"
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
                        tick().then(() => target.setSelectionRange(escaped.cursor, escaped.cursor));
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
                onblur?.();
            }}
            onpaste={handlePaste} />
    {/if}
</div>
