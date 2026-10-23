<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        variant?: 'page' | 'article' | 'site';
        reading?: boolean;
        class?: string;
        children: Snippet;
    }

    let { variant = 'page', reading = false, class: className = '', children }: Props = $props();

    const shellStyles = $derived(
        reading ? 'min-h-screen pt-4 sm:pt-6'
        : variant === 'site' ? 'min-h-[calc(100vh-4.25rem)] sm:min-h-[calc(100vh-5.25rem)]'
        : cn(
                'min-h-[calc(100vh-4rem)] pt-16 sm:min-h-[calc(100vh-5rem)] sm:pt-20',
                variant === 'article' && 'overscroll-none lg:h-dvh lg:min-h-0 lg:overflow-clip'
            )
    );
</script>

<main
    id="main"
    class={cn('flex flex-col font-sans', shellStyles, className)}>
    {@render children()}
</main>
