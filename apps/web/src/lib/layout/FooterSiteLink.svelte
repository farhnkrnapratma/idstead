<script lang="ts">
    import { cn } from '@fkp/ui/utils/cn.ts';
    import { buttonKey } from '@fkp/ui/shortcuts.ts';
    import { shortcut } from '@fkp/ui/utils/shortcut.svelte.ts';
    import { consentStore } from '../stores/consentStore.svelte';
    import type { FooterSiteLinkItem } from './footerLinks';

    interface Props {
        item: FooterSiteLinkItem;
        class?: string;
    }

    let { item, class: className = '' }: Props = $props();

    const linkClass = $derived(
        cn(
            'relative inline-flex shrink-0 cursor-pointer items-center text-left transition-colors hover:text-accent-text focus-visible:text-accent-text focus-visible:outline-none',
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
