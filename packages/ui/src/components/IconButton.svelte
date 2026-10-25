<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLButtonAttributes } from 'svelte/elements';
    import { cn } from '../utils/cn';
    import { shortcut } from '../utils/shortcut.svelte';
    import Tooltip from './Tooltip.svelte';

    interface Props extends HTMLButtonAttributes {
        ariaLabel: string;
        variant?: 'default' | 'ghost' | 'borderless' | 'overlay' | 'floating' | 'floating-accent';
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
        href?: string;
        target?: string;
        rel?: string;
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
        href,
        target,
        rel,
        children,
        type = 'button',
        disabled = false,
        ...restProps
    }: Props = $props();

    let tooltipContent = $derived(tooltip ?? ariaLabel);

    const variantStyles = {
        default:
            'glass-button hover:text-fg-accent hover:border-accent active:inset-shadow-button-pressed disabled:hover:text-fg',
        ghost: 'text-fg-secondary hover:text-fg hover:bg-surface-hover active:inset-shadow-button-pressed disabled:hover:bg-transparent disabled:hover:text-fg-secondary',
        borderless:
            'bg-transparent text-fg-secondary hover:text-fg-accent disabled:hover:text-fg-secondary',
        overlay:
            'rounded-full border border-line bg-surface text-fg-accent shadow-sm hover:bg-accent hover:text-on-accent',
        floating:
            'rounded-full glass-button text-fg shadow-md hover:text-fg-accent active:inset-shadow-button-pressed md:shadow-lg',
        'floating-accent':
            'rounded-full glass-button border-accent/40 bg-surface/90 text-fg-accent shadow-md hover:border-accent hover:bg-surface-hover active:inset-shadow-button-pressed md:shadow-lg'
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
    <svelte:element
        this={href ? 'a' : 'button'}
        href={href || undefined}
        {target}
        {rel}
        type={href ? undefined : type}
        disabled={href ? undefined : disabled}
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
    </svelte:element>
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
