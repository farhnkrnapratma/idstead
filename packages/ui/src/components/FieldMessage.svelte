<script lang="ts">
    import { CircleAlert, CircleCheck, TriangleAlert, Info } from '@lucide/svelte';
    import { cn } from '../utils/cn';

    interface Props {
        variant?: 'error' | 'success' | 'warning' | 'info';
        id?: string;
        message: string;
        class?: string;
    }

    let { variant = 'error', id, message, class: className = '' }: Props = $props();

    const variantStyles = {
        error: 'text-danger',
        success: 'text-success',
        warning: 'text-warning',
        info: 'text-text-muted'
    };
</script>

{#if message}
    <div
        {id}
        role={variant === 'error' ? 'alert' : undefined}
        aria-live={variant === 'error' ? 'polite' : 'off'}
        class={cn(
            'mt-1 flex items-center gap-1.5 text-xxs leading-tight font-medium select-none',
            variantStyles[variant],
            className
        )}>
        {#if variant === 'error'}
            <CircleAlert class="size-3 shrink-0" />
        {:else if variant === 'success'}
            <CircleCheck class="size-3 shrink-0" />
        {:else if variant === 'warning'}
            <TriangleAlert class="size-3 shrink-0" />
        {:else}
            <Info class="size-3 shrink-0" />
        {/if}
        <span>{message}</span>
    </div>
{/if}
