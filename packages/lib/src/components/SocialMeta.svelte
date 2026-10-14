<script lang="ts">
    import { siteBannerOgUrl } from '../siteIdentity';

    interface Props {
        title: string;
        description: string;
        image?: string | null;
        imageWidth?: number;
        imageHeight?: number;
        imageType?: string;
        imageAlt?: string;
        profile?: { bannerVersion?: string | null; avatar?: string; siteUrl?: string } | null;
    }

    let {
        title,
        description,
        image,
        imageWidth,
        imageHeight,
        imageType,
        imageAlt,
        profile
    }: Props = $props();

    const finalImage = image || (profile?.bannerVersion ? siteBannerOgUrl(profile) : null);
    const finalImageWidth =
        imageWidth || (finalImage && image !== siteBannerOgUrl(profile) ? 1200 : 1200);
    const finalImageHeight =
        imageHeight || (finalImage && image !== siteBannerOgUrl(profile) ? 630 : 630);
    const finalImageType = imageType || 'image/webp';
    const finalImageAlt = imageAlt || (title ? `${title} preview` : 'Page preview');
    const siteUrl = profile?.siteUrl || '';
</script>

<svelte:head>
    <!-- Open Graph -->
    <meta
        property="og:title"
        content={title} />
    <meta
        property="og:description"
        content={description} />
    <meta
        property="og:type"
        content="website" />
    <meta
        property="og:url"
        content={siteUrl} />
    {#if finalImage}
        <meta
            property="og:image"
            content={finalImage} />
        <meta
            property="og:image:secure_url"
            content={finalImage} />
        <meta
            property="og:image:type"
            content={finalImageType} />
        <meta
            property="og:image:width"
            content={String(finalImageWidth)} />
        <meta
            property="og:image:height"
            content={String(finalImageHeight)} />
        <meta
            property="og:image:alt"
            content={finalImageAlt} />
    {/if}

    <!-- Twitter Card -->
    <meta
        name="twitter:card"
        content={finalImage ? 'summary_large_image' : 'summary'} />
    <meta
        name="twitter:title"
        content={title} />
    <meta
        name="twitter:description"
        content={description} />
    {#if finalImage}
        <meta
            name="twitter:image"
            content={finalImage} />
        <meta
            name="twitter:image:alt"
            content={finalImageAlt} />
    {/if}

    <!-- Standard Meta -->
    <meta
        name="description"
        content={description} />
</svelte:head>
