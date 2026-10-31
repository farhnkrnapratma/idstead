<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import LegalPageLayout from '#app/components/LegalPageLayout.svelte';

    let { data } = $props();

    let authorName = $derived((data as any)?.author?.name || '');
    let siteUrl = $derived((data as any)?.author?.siteUrl || (data as any)?.siteUrl || '');
</script>

<LegalPageLayout
    title={data.pageData.title}
    slug="terms"
    content={data.pageData.content}
    html={data.html}
    headings={data.headings}
    updatedAt={data.pageData.updated_at}
    {authorName}
    {siteUrl} />
