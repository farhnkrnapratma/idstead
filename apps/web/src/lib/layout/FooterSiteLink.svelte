<script lang="ts">
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { buttonKey } from '@idstead/ui/shortcuts.ts';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { consentStore } from '../stores/consentStore.svelte';
    import type { FooterSiteLinkItem } from './footerLinks';

    interface Props {
        item: FooterSiteLinkItem;
        class?: string;
    }

    let { item, class: className = '' }: Props = $props();

    const linkClass = $derived(
        cn(
            'relative inline-flex shrink-0 cursor-pointer items-center text-left transition-colors hover:text-fg-accent rounded-xs focus-visible:text-fg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
            className
        )
    );
</script>

{#if item.action === 'cookies'}
    <button
        type="button"
        onclick={() => consentStore.openCustomizeModal()}
        use:shortcut={{ combo: buttonKey(item.shortcut), label: item.label }}
        class={linkClass}>
        {item.label}
    </button>
{:else}
    <a
        href={item.href}
        use:shortcut={{ combo: buttonKey(item.shortcut), label: item.label }}
        class={linkClass}>
        {item.label}
    </a>
{/if}
