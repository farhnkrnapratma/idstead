<script lang="ts">
    import { getContext } from 'svelte';
    import type { HTMLTextareaAttributes } from 'svelte/elements';
    import { autoResize } from '../utils/actions.ts';
    import type { FormFieldContext } from '../types';
    import { cn } from '../utils/cn';

    interface Props extends HTMLTextareaAttributes {
        value?: string;
        error?: boolean;
        valid?: boolean;
        variant?: 'standard' | 'floating';
        label?: string;
        required?: boolean;
        hideAsterisk?: boolean;
        useAutoResize?: boolean;
        wrapperClass?: string;
    }

    let {
        value = $bindable(''),
        error = false,
        valid = false,
        variant,
        label = '',
        required,
        hideAsterisk,
        useAutoResize = true,
        wrapperClass = '',
        rows = 4,
        class: className = '',
        disabled = false,
        id,
        placeholder = '',
        ...restProps
    }: Props = $props();

    const formCtx = getContext<FormFieldContext>('formField');
    const generatedId = $props.id();
    const fieldId = $derived(id ?? formCtx?.id ?? generatedId);
    const resolvedVariant = $derived(variant ?? formCtx?.variant ?? 'standard');
    const resolvedLabel = $derived(label || formCtx?.label || '');
    const resolvedRequired = $derived(required ?? formCtx?.required ?? false);
    const resolvedHideAsterisk = $derived(hideAsterisk ?? formCtx?.hideAsterisk ?? false);
    const isFloating = $derived(resolvedVariant === 'floating');
    const hasValue = $derived(value !== undefined && value !== null && String(value).length > 0);
    const resolvedCounter = $derived(formCtx?.counter ?? '');

    const baseStyles =
        'w-full rounded-md border border-line-subtle/50 bg-surface/85 shadow-button-surface backdrop-blur-xs text-sm text-fg transition-colors focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:cursor-not-allowed disabled:backdrop-blur-none disabled:bg-surface/20 disabled:border-line-subtle/30 disabled:opacity-50 dark:border-fg/10 dark:bg-surface/70 dark:focus:bg-surface/90';
</script>

<div class={cn('relative w-full', wrapperClass)}>
    {#if useAutoResize}
        <textarea
            id={fieldId}
            use:autoResize={value}
            bind:value
            {rows}
            {disabled}
            placeholder={isFloating ? ' ' : placeholder}
            class={cn(
                baseStyles,
                isFloating ?
                    'peer block min-h-12 px-3 pt-5! pb-1.5! text-sm leading-5 placeholder-transparent'
                :   'px-3 py-2.5 text-sm placeholder:text-fg-secondary/70',
                'resize-none scrollbar-none overflow-hidden [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
                error ? 'border-danger! ring-danger/20!' : '',
                valid && !error ? 'border-accent!' : '',
                className
            )}
            {...restProps}></textarea>
    {:else}
        <textarea
            id={fieldId}
            bind:value
            {rows}
            {disabled}
            placeholder={isFloating ? ' ' : placeholder}
            class={cn(
                baseStyles,
                isFloating ?
                    'peer block min-h-12 px-3 pt-5! pb-1.5! text-sm leading-5 placeholder-transparent'
                :   'px-3 py-2.5 text-sm placeholder:text-fg-secondary/70',
                error ? 'border-danger! ring-danger/20!' : '',
                valid && !error ? 'border-accent!' : '',
                className
            )}
            {...restProps}></textarea>
    {/if}

    {#if isFloating && resolvedLabel}
        <label
            for={fieldId}
            class={cn(
                'pointer-events-none absolute left-3 z-10 font-medium transition-all duration-200 select-none',
                'top-3 text-sm text-fg-secondary/70 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-placeholder-shown:text-fg-secondary/70',
                'peer-focus:top-1.5 peer-focus:text-2xs peer-focus:leading-none peer-focus:font-semibold peer-focus:text-fg-accent',
                'peer-not-placeholder-shown:top-1.5 peer-not-placeholder-shown:text-2xs peer-not-placeholder-shown:leading-none peer-not-placeholder-shown:font-semibold peer-not-placeholder-shown:text-fg-muted',
                hasValue ? 'top-1.5 text-2xs leading-none font-semibold text-fg-muted' : '',
                error ?
                    'text-danger! peer-not-placeholder-shown:text-danger! peer-focus:text-danger!'
                :   ''
            )}>
            {resolvedLabel}
            {#if resolvedRequired && !resolvedHideAsterisk}
                <span
                    class="text-danger"
                    aria-hidden="true">*</span>
            {/if}
        </label>
    {/if}

    {#if isFloating && resolvedCounter}
        <span
            class={cn(
                'pointer-events-none absolute top-1.5 right-3 z-10 font-mono text-2xs leading-none text-fg-muted select-none',
                hasValue ? 'block' : 'hidden peer-focus:block'
            )}>
            {resolvedCounter}
        </span>
    {/if}
</div>
