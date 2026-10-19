<script lang="ts">
    import { cn } from '@fkp/ui/utils/cn.ts';
    import FooterSiteLink from './FooterSiteLink.svelte';
    import { FOOTER_SITE_LINKS } from './footerLinks';

    interface Props {
        name?: string;
        class?: string;
    }

    let { name = '', class: className = '' }: Props = $props();
</script>

<div
    class={cn(
        'flex w-full max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 font-sans text-xs font-medium text-text-muted',
        className
    )}>
    <span class="inline-flex shrink-0 items-center text-text-muted">
        &copy; {new Date().getFullYear()}{name ? ` ${name}.` : '.'}
    </span>
    {#each FOOTER_SITE_LINKS as item (item.label)}
        <FooterSiteLink {item} />
    {/each}
</div>
