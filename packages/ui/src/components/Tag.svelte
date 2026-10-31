<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
    import { cn } from '../utils/cn';

    interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class'> {
        href?: HTMLAnchorAttributes['href'];
        variant?: 'neutral' | 'subtle' | 'accent' | 'accent-active' | 'tinted' | 'tinted-active';
        tint?: string;
        size?: 'sm' | 'md';
        children?: Snippet;
        class?: string;
    }

    let {
        variant = 'neutral',
        tint,
        href,
        size = 'sm',
        children,
        class: className = '',
        onclick,
        disabled = false,
        ...rest
    }: Props = $props();

    const variantStyles = {
        neutral: 'text-fg-muted border border-line-subtle',
        subtle: 'bg-fg-muted/10 text-fg-muted',
        accent: 'bg-accent-subtle text-fg-accent border border-accent/30',
        'accent-active': 'bg-accent-strong text-on-accent border border-accent-strong',
        tinted: 'border border-(--tag-tint)/35 bg-(--tag-tint)/10 text-[color-mix(in_oklab,var(--tag-tint)_50%,var(--color-fg))]',
        'tinted-active':
            'border border-(--tag-tint) bg-(--tag-tint)/25 text-[color-mix(in_oklab,var(--tag-tint)_50%,var(--color-fg))]'
    };

    const sizeStyles = {
        sm: 'px-2 py-0.5 text-xs leading-snug',
        md: 'px-2.5 py-1 text-sm leading-snug'
    };
</script>

<svelte:element
    this={href ? 'a'
    : onclick ? 'button'
    : 'span'}
    {href}
    type={!href && onclick ? 'button' : undefined}
    {onclick}
    disabled={!href && onclick ? disabled : undefined}
    {...rest}
    style:--tag-tint={tint}
    class={cn(
        'inline-block max-w-full rounded-md whitespace-normal',
        variantStyles[variant],
        sizeStyles[size],
        (href || onclick)
            && 'touch-target relative cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
    )}>
    {@render children?.()}
</svelte:element>
