<script lang="ts">
    import { tick } from 'svelte';
    import type { Attachment } from 'svelte/attachments';
    import hljs from 'highlight.js';
    import FieldMessage from '@idstead/ui/components/FieldMessage.svelte';
    import { enhanceMarkdownContent } from '@mdrs/dom/enhance.ts';
    import { enhanceHeadingAnchors } from '@mdrs/dom/headingAnchors.ts';
    import { contentFontStore } from '@idstead/ui/stores/contentFontStore.svelte.ts';

    interface Props {
        html: string;
        error: string;
        minHeight: string;
        isDark: boolean;
    }

    let { html, error, minHeight, isDark }: Props = $props();

    const enhance: Attachment<HTMLDivElement> = container => {
        if (!html) return;
        const dark = isDark;
        let cancelled = false;
        tick().then(() => {
            if (cancelled) return;
            container.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block as HTMLElement);
            });
            enhanceMarkdownContent({ container, isDark: dark, onCodeCopy: () => {} });
            enhanceHeadingAnchors(container);
        });
        return () => {
            cancelled = true;
        };
    };
</script>

<div
    {@attach enhance}
    class="mdrs editor-preview font-content-{contentFontStore.current} editor-surface w-full p-6"
    style:min-height={minHeight || undefined}>
    {#if error}<FieldMessage
            variant="error"
            message={error} />{/if}
    {#if html}
        {@html html}
    {:else}
        <p class="text-text-muted italic">Nothing to preview yet…</p>
    {/if}
</div>
