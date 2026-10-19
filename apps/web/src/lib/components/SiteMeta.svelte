<script lang="ts">
    interface Props {
        title: string;
        description: string;
        path: string;
        siteName: string;
        siteUrl: string;
    }

    let { title, description, path, siteName, siteUrl }: Props = $props();

    const fullTitle = $derived(siteName ? `${title} · ${siteName}` : title);
    const canonical = $derived(siteUrl ? `${siteUrl.replace(/\/$/, '')}${path}` : path);
</script>

<svelte:head>
    <title>{fullTitle}</title>
    <meta
        name="description"
        content={description} />
    <link
        rel="canonical"
        href={canonical} />
    <meta
        property="og:title"
        content={fullTitle} />
    <meta
        property="og:description"
        content={description} />
    <meta
        property="og:type"
        content="website" />
    <meta
        property="og:url"
        content={canonical} />
    <meta
        property="og:site_name"
        content={siteName} />
    <meta
        name="twitter:card"
        content="summary" />
    <meta
        name="twitter:title"
        content={fullTitle} />
    <meta
        name="twitter:description"
        content={description} />
</svelte:head>
