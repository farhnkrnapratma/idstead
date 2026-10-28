<script lang="ts">
    import LegalPageLayout from '#app/components/LegalPageLayout.svelte';

    let { data } = $props();

    let authorName = $derived((data as any)?.author?.name || '');
    let siteUrl = $derived((data as any)?.author?.siteUrl || (data as any)?.siteUrl || '');
</script>

<LegalPageLayout
    title={data.pageData.title}
    slug="ai-disclosure"
    content={data.pageData.content}
    html={data.html}
    headings={data.headings}
    updatedAt={data.pageData.updated_at}
    {authorName}
    {siteUrl} />
