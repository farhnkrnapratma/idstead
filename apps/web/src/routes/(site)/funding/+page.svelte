<script lang="ts">
    import { HeartHandshake } from '@lucide/svelte';
    import { PageMain } from '@idstead/ui';
    import FooterSection from '#app/layout/FooterSection.svelte';
    import LinkGridSection from '#app/components/LinkGridSection.svelte';
    import SiteMeta from '#app/components/SiteMeta.svelte';

    let { data } = $props();

    interface FundingPlatform {
        label: string;
        value: string;
        shortValue?: string;
        href: string;
        icon: string;
        color?: string;
        description?: string;
    }

    let fundingPlatforms = $derived<FundingPlatform[]>(
        (data.funding || []).map(f => ({
            label: f.platform,
            value: f.displayValue || f.platform,
            href: f.url,
            icon: f.icon || '',
            description: f.description || ''
        }))
    );
</script>

<SiteMeta
    title="Supporting & Funding"
    description={data.author?.name ?
        `Ways to support the open source work of ${data.author.name}.`
    :   'Ways to support this open source work.'}
    path="/funding"
    siteName={data.author?.name || ''}
    siteUrl={data.author?.siteUrl || ''} />

<PageMain variant="site">
    <LinkGridSection
        title="Supporting & Funding"
        items={fundingPlatforms}
        shortcutGroup="funding"
        emptyIcon={HeartHandshake}
        emptyTitle="No funding platforms yet"
        emptyDescription="Check back soon for ways to support this work." />

    <FooterSection />
</PageMain>
