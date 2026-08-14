<!-- @format -->
<script lang="ts">
  import LegalPageLayout from '$lib/components/LegalPageLayout.svelte'

  let {data} = $props()

  let authorName = $derived(
    (data as any)?.author?.name || 'Farhan Kurnia Pratama'
  )
  let siteUrl = $derived((data as any)?.siteUrl || 'https://fkp.my.id')
</script>

<LegalPageLayout
  title={data.pageData.title}
  slug="security"
  content={data.pageData.content}
  html={data.html}
  headings={data.headings}
  updatedAt={data.pageData.updated_at}
  {authorName}
  {siteUrl} />
