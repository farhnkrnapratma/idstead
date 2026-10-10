<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        spacing?: 'compact' | 'normal' | 'spacious' | 'none';
        bordered?: boolean;
        class?: string;
        children?: Snippet;
    }

    let { spacing = 'normal', bordered = false, class: className = '', children }: Props = $props();

    const spacingStyles = {
        compact: 'py-6 md:py-8',
        normal: 'py-10 md:py-14',
        spacious: 'py-14 md:py-20',
        none: ''
    };
</script>

<section
    class={cn(
        'relative z-10 w-full',
        spacingStyles[spacing],
        bordered ? 'border-t border-border-subtle' : '',
        className
    )}>
    {@render children?.()}
</section>
