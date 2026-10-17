<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLButtonAttributes } from 'svelte/elements';
    import { cn } from '../utils/cn';
    import { shortcut } from '../utils/shortcut.svelte';
    import Tooltip from './Tooltip.svelte';

    interface Props extends HTMLButtonAttributes {
        ariaLabel: string;
        variant?: 'default' | 'ghost' | 'borderless';
        size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg';
        tooltip?: string;
        tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right';
        tooltipAlign?: 'center' | 'left' | 'right' | 'start' | 'end';
        showTooltip?: boolean;
        keyboardShortcut?: string;
        shortcutGroup?: string;
        shortcutChordKey?: string;
        shortcutScope?: string;
        shortcutLabel?: string;
        children?: Snippet;
    }

    let {
        ariaLabel,
        variant = 'default',
        size = 'md',
        tooltip,
        tooltipPlacement = 'bottom',
        tooltipAlign = 'center',
        showTooltip = true,
        keyboardShortcut,
        shortcutGroup,
        shortcutChordKey,
        shortcutScope,
        shortcutLabel,
        class: className = '',
        children,
        type = 'button',
        disabled = false,
        ...restProps
    }: Props = $props();

    let tooltipContent = $derived(tooltip ?? ariaLabel);

    const variantStyles = {
        default:
            'glass-button hover:text-accent-text hover:border-accent active:inset-shadow-button-pressed disabled:hover:text-text-primary',
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-hover active:inset-shadow-button-pressed disabled:hover:bg-transparent disabled:hover:text-text-secondary',
        borderless:
            'bg-transparent text-text-secondary hover:text-accent-text disabled:hover:text-text-secondary'
    };

    const sizeStyles = {
        '2xs': 'size-7 text-xs',
        xs: 'size-6.5 text-2xs',
        sm: 'size-8 text-xs',
        md: 'size-9 text-sm',
        lg: 'size-11 text-base'
    };
</script>

{#snippet buttonNode()}
    <button
        {type}
        {disabled}
        aria-label={ariaLabel}
        use:shortcut={{
            combo: keyboardShortcut,
            group: shortcutGroup,
            chordKey: shortcutChordKey,
            scope: shortcutScope,
            label: shortcutLabel ?? ariaLabel,
            disabled: Boolean(disabled)
        }}
        class={cn(
            'relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md leading-none transition select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:translate-y-px pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-[max(100%,--spacing(9))] pointer-coarse:after:-translate-1/2 [&>i]:inline-flex [&>i]:items-center [&>i]:justify-center [&>i]:leading-none [&>span>i]:inline-flex [&>span>i]:items-center [&>span>i]:leading-none [&>span>svg]:block [&>span>svg]:shrink-0 [&>svg]:block [&>svg]:shrink-0',
            variantStyles[variant],
            sizeStyles[size],
            className
        )}
        {...restProps}>
        {@render children?.()}
    </button>
{/snippet}

{#if showTooltip && tooltipContent}
    <Tooltip
        content={tooltipContent}
        placement={tooltipPlacement}
        align={tooltipAlign}>
        {@render buttonNode()}
    </Tooltip>
{:else}
    {@render buttonNode()}
{/if}
