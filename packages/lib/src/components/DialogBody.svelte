<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        class?: string;
        children?: Snippet;
    }

    let { class: className = '', children }: Props = $props();
</script>

<div class={cn('mt-4 text-left text-sm text-text-primary', className)}>
    {@render children?.()}
</div>
