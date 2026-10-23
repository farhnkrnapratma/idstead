<script lang="ts">
    import { cn } from '@idstead/ui/utils/cn.ts';
    import FooterSiteLink from './FooterSiteLink.svelte';
    import { FOOTER_SITE_LINKS } from './footerLinks';
    import { isHiddenLegalPath } from '#app/legalVisibility.ts';
    import { copyrightLine } from '@idstead/domain/copyright.ts';

    interface Props {
        name?: string;
        class?: string;
    }

    let { name = '', class: className = '' }: Props = $props();

    const siteLinks = $derived(FOOTER_SITE_LINKS.filter(item => !isHiddenLegalPath(item.href)));
</script>

<div
    class={cn(
        'flex w-full max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 font-sans text-xs font-medium text-text-muted',
        className
    )}>
    <span class="inline-flex shrink-0 items-center text-text-muted">
        {copyrightLine(name, new Date().getFullYear())}
    </span>
    {#each siteLinks as item (item.label)}
        <FooterSiteLink {item} />
    {/each}
</div>
