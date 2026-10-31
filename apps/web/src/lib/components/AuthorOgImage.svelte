<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { publicAvatarUrl, publicBannerOgUrl } from '#lib/siteIdentity.ts';

    interface Props {
        author: Parameters<typeof publicBannerOgUrl>[0];
        alt?: string;
    }

    let { author, alt = '' }: Props = $props();

    const banner = $derived(publicBannerOgUrl(author));
    const image = $derived(banner || publicAvatarUrl(author));
</script>

<svelte:head>
    <meta
        property="og:image"
        content={image} />
    <meta
        property="og:image:secure_url"
        content={image} />
    <meta
        property="og:image:type"
        content={banner ? 'image/webp' : 'image/png'} />
    <meta
        property="og:image:width"
        content={banner ? '1200' : '512'} />
    <meta
        property="og:image:height"
        content={banner ? '630' : '512'} />
    {#if alt}
        <meta
            property="og:image:alt"
            content={alt} />
    {/if}
    <meta
        name="twitter:image"
        content={image} />
</svelte:head>
