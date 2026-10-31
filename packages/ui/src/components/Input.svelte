<script lang="ts">
    import FieldLabelText from './FieldLabelText.svelte';
    import { resolveFormField } from './formField.svelte.ts';
    import { getContext, type Snippet } from 'svelte';
    import { Search } from '@lucide/svelte';
    import {
        FILTER_TOOLBAR_CONTROL_SIZE,
        type FilterToolbarContext
    } from './filter/filterToolbarContext';
    import type { HTMLInputAttributes } from 'svelte/elements';
    import { cn } from '../utils/cn';
    import { shortcut } from '../utils/shortcut.svelte';

    interface Props extends Omit<HTMLInputAttributes, 'size'> {
        value?: string | number;
        error?: boolean;
        valid?: boolean;
        size?: 'sm' | 'md' | 'lg';
        variant?: 'standard' | 'floating';
        label?: string;
        required?: boolean;
        hideAsterisk?: boolean;
        fullWidth?: boolean;
        leadingIcon?: string;
        trailingIcon?: string;
        leadingSlot?: Snippet;
        trailingSlot?: Snippet;
        keyboardShortcut?: string;
        shortcutScope?: string;
        shortcutLabel?: string;
    }

    let {
        value = $bindable(''),
        error = false,
        valid = false,
        size,
        variant,
        label = '',
        required,
        hideAsterisk,
        fullWidth = true,
        leadingIcon = '',
        trailingIcon = '',
        leadingSlot,
        trailingSlot,
        keyboardShortcut,
        shortcutScope,
        shortcutLabel,
        class: className = '',
        disabled = false,
        id,
        placeholder = '',
        ...restProps
    }: Props = $props();

    const filterToolbar = getContext<FilterToolbarContext | undefined>(FILTER_TOOLBAR_CONTROL_SIZE);
    const resolvedSize = $derived(size ?? filterToolbar?.controlSize ?? 'md');

    const sizeStyles = {
        sm: 'box-border h-8 text-xs rounded-md px-2.5',
        md: 'box-border h-9 text-sm rounded-md px-3',
        lg: 'box-border h-11 text-base rounded-md px-4'
    };

    const field = resolveFormField(() => ({ variant, label, required, hideAsterisk }), 'standard');
    const formCtx = field.context;
    const generatedId = $props.id();
    const fieldId = $derived(id ?? formCtx?.id ?? generatedId);
    const hasValue = $derived(value !== undefined && value !== null && String(value).length > 0);
    const showSearchIcon = $derived(restProps.type === 'search' && !leadingIcon && !leadingSlot);

    const searchIconStyles = {
        sm: { wrapper: 'left-2.5', icon: 'size-3.5', input: 'pl-8' },
        md: { wrapper: 'left-3', icon: 'size-4', input: 'pl-9' },
        lg: { wrapper: 'left-4', icon: 'size-4.5', input: 'pl-11' }
    };
</script>

<div class={cn('relative flex min-w-0 items-center', fullWidth ? 'w-full' : '')}>
    {#if leadingIcon}
        <div
            class={cn(
                'pointer-events-none absolute left-3 z-10 flex items-center text-fg-secondary',
                field.isFloating ? 'top-1/2 -translate-y-1/2' : ''
            )}>
            <i
                class="bi {leadingIcon} text-sm"
                aria-hidden="true"></i>
        </div>
    {:else if leadingSlot}
        <div
            class={cn(
                'pointer-events-none absolute left-2 z-10 flex items-center',
                field.isFloating ? 'top-1/2 -translate-y-1/2' : ''
            )}>
            {@render leadingSlot()}
        </div>
    {:else if showSearchIcon}
        <div
            class={cn(
                'pointer-events-none absolute z-10 flex items-center text-fg-muted',
                searchIconStyles[resolvedSize].wrapper
            )}>
            <Search
                class={searchIconStyles[resolvedSize].icon}
                aria-hidden="true" />
        </div>
    {/if}

    <input
        id={fieldId}
        bind:value
        {disabled}
        placeholder={field.isFloating ? ' ' : placeholder}
        use:shortcut={{
            combo: keyboardShortcut,
            scope: shortcutScope,
            label: shortcutLabel,
            placement: 'inline',
            disabled: Boolean(disabled)
        }}
        class={cn(
            'border border-line-subtle/50 bg-surface/85 text-fg shadow-button-surface backdrop-blur-xs transition-colors focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:cursor-not-allowed disabled:border-line-subtle/30 disabled:bg-surface/20 disabled:opacity-50 disabled:backdrop-blur-none dark:border-fg/10 dark:bg-surface/70 dark:focus:bg-surface/90',
            fullWidth ? 'w-full min-w-0' : '',
            field.isFloating ?
                'peer block h-12 rounded-md px-3 pt-5! pb-1.5! text-sm leading-5 placeholder-transparent'
            :   sizeStyles[resolvedSize],
            field.isFloating ? '' : 'placeholder:text-fg-secondary/70',
            leadingSlot ? 'pl-12'
            : leadingIcon ? 'pl-9'
            : showSearchIcon ? searchIconStyles[resolvedSize].input
            : '',
            trailingIcon || trailingSlot ? 'pr-9' : '',
            error ? 'border-danger! ring-danger/20!' : '',
            valid && !error ? 'border-accent! ring-accent/20!' : '',
            className
        )}
        {...restProps} />

    {#if field.isFloating && field.label}
        <label
            for={fieldId}
            class={cn(
                'pointer-events-none absolute z-10 font-medium transition-all duration-200 select-none',
                'top-1/2 -translate-y-1/2 text-sm text-fg-secondary/70 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-fg-secondary/70',
                'peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-2xs peer-focus:leading-none peer-focus:font-semibold peer-focus:text-fg-accent',
                'peer-not-placeholder-shown:top-1.5 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:text-2xs peer-not-placeholder-shown:leading-none peer-not-placeholder-shown:font-semibold peer-not-placeholder-shown:text-fg-muted',
                hasValue ?
                    'top-1.5 translate-y-0 text-2xs leading-none font-semibold text-fg-muted'
                :   '',
                leadingSlot ? 'left-12'
                : leadingIcon ? 'left-9'
                : 'left-3',
                error ?
                    'text-danger! peer-not-placeholder-shown:text-danger! peer-focus:text-danger!'
                :   ''
            )}>
            <FieldLabelText
                text={field.label}
                required={field.required && !field.hideAsterisk} />
        </label>
    {/if}

    {#if field.isFloating && field.counter}
        <span
            class={cn(
                'pointer-events-none absolute top-1.5 z-10 font-mono text-2xs leading-none text-fg-muted select-none',
                hasValue ? 'block' : 'hidden peer-focus:block',
                trailingIcon || trailingSlot ? 'right-9' : 'right-3'
            )}>
            {field.counter}
        </span>
    {/if}

    {#if trailingIcon}
        <div
            class={cn(
                'pointer-events-none absolute right-3 z-10 flex items-center text-fg-secondary',
                field.isFloating ? 'top-1/2 -translate-y-1/2' : ''
            )}>
            <i
                class="bi {trailingIcon} text-sm"
                aria-hidden="true"></i>
        </div>
    {:else if trailingSlot}
        <div
            class={cn(
                'absolute right-2 z-10 flex items-center',
                field.isFloating ? 'top-1/2 -translate-y-1/2' : ''
            )}>
            {@render trailingSlot()}
        </div>
    {/if}
</div>
