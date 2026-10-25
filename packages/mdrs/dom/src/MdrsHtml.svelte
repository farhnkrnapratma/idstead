<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';
    import { sanitizeHtml } from '@mdrs/core';

    interface Props extends HTMLAttributes<HTMLDivElement> {
        html: string;
    }

    let { html, ...rest }: Props = $props();

    const safeHtml = $derived(sanitizeHtml(html));
</script>

<div {...rest}>
    {@html safeHtml}
</div>
