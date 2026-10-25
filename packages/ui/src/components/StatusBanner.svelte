<script lang="ts">
    import type { Snippet } from 'svelte';
    import { Info, CircleCheck, TriangleAlert, OctagonAlert } from '@lucide/svelte';
    import { cn } from '../utils/cn';

    interface Props {
        variant?: 'info' | 'success' | 'warning' | 'error';
        title?: string;
        message?: string;
        class?: string;
        children?: Snippet;
    }

    let {
        variant = 'info',
        title = '',
        message = '',
        class: className = '',
        children
    }: Props = $props();

    const variantStyles = {
        info: 'border-line-subtle/50 bg-surface/70 text-fg',
        success: 'border-success/30 bg-success-subtle/20 text-fg',
        warning: 'border-warning/30 bg-warning/10 text-fg',
        error: 'border-danger/30 bg-danger-subtle/20 text-fg'
    };
</script>

<div
    role={variant === 'error' ? 'alert' : 'status'}
    aria-live={variant === 'error' ? 'assertive' : 'polite'}
    class={cn(
        'flex items-start gap-3 rounded-md glass-card p-4 text-xs select-none',
        variantStyles[variant],
        className
    )}>
    {#if variant === 'success'}
        <CircleCheck class="mt-0.5 size-4 shrink-0 self-start text-success" />
    {:else if variant === 'warning'}
        <TriangleAlert class="mt-0.5 size-4 shrink-0 self-start text-warning" />
    {:else if variant === 'error'}
        <OctagonAlert class="mt-0.5 size-4 shrink-0 self-start text-danger" />
    {:else}
        <Info class="mt-0.5 size-4 shrink-0 self-start text-fg-muted" />
    {/if}
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        {#if title}
            <span class="leading-snug font-bold">{title}</span>
        {/if}
        {#if children}
            <div class="leading-relaxed font-medium wrap-break-word">
                {@render children()}
            </div>
        {:else if message}
            <span class="leading-relaxed font-medium wrap-break-word">{message}</span>
        {/if}
    </div>
</div>
