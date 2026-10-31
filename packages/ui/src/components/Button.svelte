<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLButtonAttributes } from 'svelte/elements';
    import { cn } from '../utils/cn';
    import LoadingIndicator from './LoadingIndicator.svelte';
    import { shortcut, type ShortcutParams } from '../utils/shortcut.svelte';

    interface Props extends Omit<HTMLButtonAttributes, 'type'> {
        type?: 'primary' | 'danger' | 'outline' | 'ghost' | 'secondary' | 'tertiary';
        tone?: 'neutral' | 'critical';
        htmlType?: 'button' | 'submit' | 'reset';
        size?: '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg';
        isLoading?: boolean;
        fullWidth?: boolean;
        leading?: Snippet;
        trailing?: Snippet;
        href?: string;
        target?: string;
        rel?: string;
        download?: boolean | string;
        children?: Snippet;
        responsiveIconOnly?: boolean;
        label?: string;
        truncateMiddle?: boolean;
        keyboardShortcut?: string;
        shortcutGroup?: string;
        shortcutChordKey?: string;
        shortcutScope?: string;
        shortcutLabel?: string;
        shortcutPlacement?: ShortcutParams['placement'];
    }

    let {
        type = 'primary',
        tone = 'neutral',
        htmlType = 'button',
        size = 'md',
        isLoading = false,
        disabled = false,
        fullWidth = false,
        leading,
        trailing,
        href = '',
        target,
        rel,
        download,
        responsiveIconOnly = false,
        label,
        truncateMiddle = false,
        keyboardShortcut,
        shortcutGroup,
        shortcutChordKey,
        shortcutScope,
        shortcutLabel,
        shortcutPlacement,
        class: className = '',
        title,
        'aria-label': ariaLabel,
        onclick,
        children,
        ...restProps
    }: Props = $props();

    const baseStyles =
        'inline-flex min-w-0 items-center justify-center whitespace-nowrap transition cursor-pointer select-none leading-none motion-safe:active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>svg]:block [&>svg]:shrink-0 [&>span>svg]:block [&>span>svg]:shrink-0 [&>i]:inline-flex [&>i]:shrink-0 [&>i]:items-center [&>i]:leading-none [&>span>i]:inline-flex [&>span>i]:items-center [&>span>i]:leading-none';

    const typeToneStyles: Record<string, string> = {
        'primary:neutral':
            'font-semibold bg-accent-strong bg-linear-to-b from-accent-sheen to-accent-strong text-on-accent inset-shadow-button-fill shadow-button-accent hover:from-accent-hover-sheen hover:to-accent-hover hover:text-on-accent-hover hover:shadow-button-accent-hover active:from-accent-active active:to-accent-active active:text-on-accent active:shadow-2xs active:inset-shadow-button-pressed disabled:shadow-none disabled:hover:from-accent-sheen disabled:hover:to-accent-strong disabled:hover:text-on-accent aria-disabled:shadow-none',
        'primary:critical':
            'font-semibold bg-danger-strong bg-linear-to-b from-danger-sheen to-danger-strong text-on-danger inset-shadow-button-fill shadow-button-danger hover:from-danger-hover-sheen hover:to-danger-strong-hover hover:shadow-button-danger-hover active:from-danger-strong-hover active:to-danger-strong-hover active:shadow-2xs active:inset-shadow-button-pressed disabled:shadow-none disabled:hover:from-danger-sheen disabled:hover:to-danger-strong aria-disabled:shadow-none',
        'secondary:neutral':
            'glass-button hover:border-accent active:inset-shadow-button-pressed disabled:hover:border-line-subtle',
        'secondary:critical':
            'border border-danger/30 bg-surface text-danger-strong shadow-button-surface inset-shadow-button-surface hover:bg-danger-subtle/40 hover:border-danger active:inset-shadow-button-pressed disabled:hover:bg-surface dark:hover:bg-danger-subtle/30',
        'tertiary:neutral':
            'border border-line-subtle bg-surface-muted text-fg-secondary shadow-button-surface inset-shadow-button-surface hover:bg-surface-hover hover:text-fg hover:border-accent active:inset-shadow-button-pressed disabled:hover:bg-surface-muted font-medium',
        'tertiary:critical':
            'border border-danger/30 bg-danger-subtle/70 text-danger-strong shadow-button-surface inset-shadow-button-surface hover:bg-danger-subtle active:inset-shadow-button-pressed disabled:hover:bg-danger-subtle/70 dark:bg-danger-subtle/40',
        'outline:neutral':
            'border border-line-subtle bg-transparent text-fg shadow-2xs hover:bg-surface-hover hover:border-accent disabled:hover:bg-transparent disabled:hover:border-line-subtle ',
        'outline:critical':
            'border border-danger/30 bg-transparent text-danger-strong shadow-2xs hover:bg-danger-subtle disabled:hover:bg-transparent',
        'ghost:neutral':
            'text-fg-secondary hover:text-fg-accent disabled:hover:text-fg-secondary disabled:hover:bg-transparent',
        'ghost:critical': 'text-danger-strong hover:bg-danger-subtle disabled:hover:bg-transparent',
        'danger:critical':
            'font-semibold border border-danger/30 bg-danger-subtle/70 text-danger-strong shadow-button-surface inset-shadow-button-surface hover:border-danger-strong hover:bg-danger-strong hover:text-on-danger hover:inset-shadow-button-fill hover:shadow-button-danger active:shadow-2xs active:inset-shadow-button-pressed disabled:hover:border-danger/30 disabled:hover:bg-danger-subtle/70 disabled:hover:text-danger-strong disabled:hover:shadow-button-surface disabled:hover:inset-shadow-button-surface dark:bg-danger-subtle/40'
    };

    const styleKey = $derived(type === 'danger' ? 'danger:critical' : `${type}:${tone}`);

    const sizeStyles = {
        '3xs': 'h-6 px-2 text-xs gap-1 rounded-sm',
        '2xs': 'h-7 px-2.5 text-xs gap-1.5 rounded-sm',
        xs: 'h-7.5 px-3 text-xs gap-1.5 rounded-md',
        sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
        md: 'h-9 px-4 text-xs sm:text-sm gap-2 rounded-md',
        lg: 'h-11 px-5 text-sm gap-2.5 rounded-md'
    };

    const responsiveSizeStyles = {
        '3xs': 'size-6 shrink-0 p-0 text-xs gap-1 rounded-sm sm:h-6 sm:w-auto sm:px-2',
        '2xs': 'size-7 shrink-0 p-0 text-xs gap-1.5 rounded-sm sm:h-7 sm:w-auto sm:px-2.5',
        xs: 'size-8 shrink-0 p-0 text-xs gap-1.5 rounded-md sm:h-7.5 sm:w-auto sm:px-3',
        sm: 'size-8 shrink-0 p-0 text-xs gap-1.5 rounded-md sm:h-8 sm:w-auto sm:px-3 sm:text-xs sm:gap-1.5',
        md: 'size-8 shrink-0 p-0 text-xs gap-1.5 rounded-md sm:h-9 sm:w-auto sm:px-4 sm:text-sm sm:gap-2',
        lg: 'size-8 shrink-0 p-0 text-xs gap-1.5 rounded-md sm:h-11 sm:w-auto sm:px-5 sm:text-sm sm:gap-2.5'
    };

    const labelText =
        'min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap [text-box:trim-both_cap_alphabetic]';
    const labelSuffix = 'shrink-0 whitespace-nowrap [text-box:trim-both_cap_alphabetic]';

    const iconSlot = 'inline-flex shrink-0 items-center justify-center leading-none';
    const compactSize = $derived(size === '3xs' || size === '2xs');
    const leadingNudge = $derived(
        responsiveIconOnly ?
            compactSize ? 'sm:-ms-px'
            :   'sm:-ms-0.5'
        : compactSize ? '-ms-px'
        : '-ms-0.5'
    );
    const trailingNudge = $derived(
        responsiveIconOnly ?
            compactSize ? 'sm:-me-px'
            :   'sm:-me-0.5'
        : compactSize ? '-me-px'
        : '-me-0.5'
    );
    const hasText = $derived(Boolean(label || children));

    const splitLabel = $derived.by(() => {
        if (!label) return { prefix: '', suffix: '', hasSpace: false };
        const trimmed = label.trim();
        const lastSpaceIndex = trimmed.lastIndexOf(' ');
        if (lastSpaceIndex > 0) {
            return {
                prefix: trimmed.slice(0, lastSpaceIndex),
                suffix: trimmed.slice(lastSpaceIndex + 1),
                hasSpace: true
            };
        }
        const lastDotIndex = trimmed.lastIndexOf('.');
        if (lastDotIndex > 0 && trimmed.length - lastDotIndex <= 6) {
            return {
                prefix: trimmed.slice(0, lastDotIndex),
                suffix: trimmed.slice(lastDotIndex),
                hasSpace: false
            };
        }
        if (trimmed.length > 8) {
            const splitAt = Math.ceil(trimmed.length * 0.6);
            return {
                prefix: trimmed.slice(0, splitAt),
                suffix: trimmed.slice(splitAt),
                hasSpace: false
            };
        }
        return { prefix: trimmed, suffix: '', hasSpace: false };
    });

    const inactive = $derived(disabled || isLoading);
    const resolvedTitle = $derived(
        title || (label && (responsiveIconOnly || truncateMiddle) ? label : undefined)
    );
    const resolvedAriaLabel = $derived(ariaLabel || label || undefined);

    function handleClick(event: Parameters<NonNullable<typeof onclick>>[0]) {
        if (inactive) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        onclick?.(event);
    }
</script>

<svelte:element
    this={href ? 'a' : 'button'}
    href={href || undefined}
    {target}
    {rel}
    download={href ?
        download === true ?
            ''
        :   download
    :   undefined}
    type={href ? undefined : htmlType}
    disabled={href ? undefined : disabled && !isLoading}
    aria-disabled={(href && inactive) || isLoading ? 'true' : undefined}
    aria-busy={isLoading || undefined}
    tabindex={href && inactive ? -1 : undefined}
    title={resolvedTitle}
    aria-label={resolvedAriaLabel}
    use:shortcut={{
        combo: keyboardShortcut,
        group: shortcutGroup,
        chordKey: shortcutChordKey,
        scope: shortcutScope,
        label: shortcutLabel ?? resolvedAriaLabel ?? label,
        placement: shortcutPlacement,
        disabled: inactive
    }}
    class={cn(
        baseStyles,
        'touch-target relative',
        typeToneStyles[styleKey],
        responsiveIconOnly ? responsiveSizeStyles[size] : sizeStyles[size],
        fullWidth ? 'w-full' : '',
        className
    )}
    {...restProps}
    onclick={handleClick}>
    {#if isLoading}
        <LoadingIndicator
            size="inline"
            tone="current"
            decorative />
    {:else if leading}
        <span class={cn(iconSlot, hasText && leadingNudge)}>
            {@render leading()}
        </span>
    {/if}

    {#if label}
        {#if responsiveIconOnly}
            <span class="hidden sm:inline-flex sm:max-w-full sm:min-w-0 sm:items-center">
                {#if truncateMiddle}
                    <span class="inline-flex max-w-full min-w-0 items-center overflow-x-clip">
                        <span class={cn(labelText, 'shrink')}>{splitLabel.prefix}</span>
                        {#if splitLabel.suffix}
                            <span class={labelSuffix}
                                >{#if splitLabel.hasSpace}&nbsp;{/if}{splitLabel.suffix}</span>
                        {/if}
                    </span>
                {:else}
                    <span class={labelText}>{label}</span>
                {/if}
            </span>
        {:else if truncateMiddle}
            <span class="inline-flex max-w-full min-w-0 items-center overflow-x-clip">
                <span class={cn(labelText, 'shrink')}>{splitLabel.prefix}</span>
                {#if splitLabel.suffix}
                    <span class={labelSuffix}
                        >{#if splitLabel.hasSpace}&nbsp;{/if}{splitLabel.suffix}</span>
                {/if}
            </span>
        {:else}
            <span class={labelText}>{label}</span>
        {/if}
    {:else if responsiveIconOnly}
        <span class="sr-only sm:not-sr-only sm:inline-flex sm:items-center">
            {@render children?.()}
        </span>
    {:else}
        {@render children?.()}
    {/if}

    {#if trailing && !isLoading}
        <span class={cn(iconSlot, hasText && trailingNudge)}>
            {@render trailing()}
        </span>
    {/if}
</svelte:element>
