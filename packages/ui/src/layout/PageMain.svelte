<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        variant?: 'site' | 'article';
        reading?: boolean;
        class?: string;
        children: Snippet;
    }

    let { variant = 'site', reading = false, class: className = '', children }: Props = $props();

    const shellStyles = $derived(
        reading ?
            'min-h-screen pt-4 sm:pt-6'
        :   cn(
                'min-h-[calc(100vh-3.5rem)]',
                variant === 'article'
                    && 'overscroll-none lg:h-[calc(100dvh-3.5rem)] lg:min-h-0 lg:overflow-clip'
            )
    );
</script>

<main
    id="main"
    class={cn('flex flex-col font-sans', shellStyles, className)}>
    {@render children()}
</main>
