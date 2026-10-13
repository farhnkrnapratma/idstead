<script lang="ts">
    import { ArrowRight } from '@lucide/svelte';
    import { cn } from '../utils/cn';

    interface Props {
        label: string;
        href: string;
        class?: string;
    }

    let { label, href, class: className = '' }: Props = $props();
</script>

<div
    class={cn(
        'mt-6 flex items-center justify-end border-t border-border-subtle/50 pt-4 select-none',
        className
    )}>
    <a
        {href}
        class="group inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-text-secondary transition-colors hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
        <span>{label}</span>
        <ArrowRight class="size-3.5 transition-transform select-none group-hover:translate-x-1" />
    </a>
</div>
