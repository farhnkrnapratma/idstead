<script lang="ts">
    import { cn } from '../utils/cn';

    interface Props {
        current: number;
        max: number;
        id?: string;
        class?: string;
    }

    let { current, max, id, class: className = '' }: Props = $props();

    const isWarning = $derived(current >= max * 0.85 && current < max);
    const isExceeded = $derived(current >= max);
</script>

<span
    {id}
    aria-live="polite"
    class={cn(
        'font-mono text-2xs transition-colors select-none',
        isExceeded ? 'font-bold text-danger'
        : isWarning ? 'font-semibold text-warning'
        : 'text-text-muted',
        className
    )}>
    {current}/{max}
</span>
