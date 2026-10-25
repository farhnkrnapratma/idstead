<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLButtonAttributes } from 'svelte/elements';
    import { cn } from '../utils/cn';

    interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class'> {
        variant?: 'neutral' | 'subtle' | 'accent' | 'accent-active';
        size?: 'sm' | 'md';
        children?: Snippet;
        class?: string;
    }

    let {
        variant = 'neutral',
        size = 'sm',
        children,
        class: className = '',
        onclick,
        disabled = false,
        ...rest
    }: Props = $props();

    const variantStyles = {
        neutral: 'text-fg-muted border border-fg-muted/20',
        subtle: 'bg-fg-muted/10 text-fg-muted',
        accent: 'bg-accent-subtle text-fg-accent border border-accent/20',
        'accent-active': 'bg-accent text-on-accent border border-accent/20'
    };

    const sizeStyles = {
        sm: 'px-2 py-0.5 text-xs leading-snug',
        md: 'px-2.5 py-1 text-sm leading-snug'
    };
</script>

<svelte:element
    this={onclick ? 'button' : 'span'}
    type={onclick ? 'button' : undefined}
    {onclick}
    disabled={onclick ? disabled : undefined}
    {...rest}
    class={cn(
        'inline-block max-w-full rounded-full whitespace-normal',
        variantStyles[variant],
        sizeStyles[size],
        onclick
            && 'cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
    )}>
    {@render children?.()}
</svelte:element>
