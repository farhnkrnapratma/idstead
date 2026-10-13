<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'custom';
        color?: string;
        size?: 'sm' | 'md';
        circle?: boolean;
        children?: Snippet;
        class?: string;
    }

    let {
        variant = 'default',
        color,
        size = 'sm',
        circle = false,
        children,
        class: className = ''
    }: Props = $props();

    const variantStyles = {
        custom: 'border border-current/30 bg-current/10 text-(--badge-color)',
        default: 'bg-border-subtle/50 text-text-secondary border border-border-subtle',
        accent: 'bg-accent-subtle text-accent-text border border-accent/30 font-bold',
        success: 'bg-success-subtle text-success-strong border border-success/30 font-bold',
        warning: 'bg-warning-subtle text-warning-strong border border-warning/30 font-bold',
        danger: 'bg-danger-subtle text-danger border border-danger/30 font-bold'
    };

    const sizeStyles = { sm: 'px-2 py-0.5 text-2xs', md: 'px-2.5 py-1 text-xs' };
    const circleStyles = {
        sm: 'size-5.5 justify-center p-0 text-2xs leading-none tracking-normal',
        md: 'size-7 justify-center p-0 text-xs leading-none tracking-normal'
    };
</script>

<span
    style:--badge-color={color}
    class={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold tracking-wide select-none',
        variantStyles[variant],
        circle ? circleStyles[size] : sizeStyles[size],
        className
    )}>
    {@render children?.()}
</span>
