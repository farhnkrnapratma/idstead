<script lang="ts">
  import {MailCheck, MailX, TriangleAlert} from '@lucide/svelte';
  import Button from '#lib/components/Button.svelte';
  import EmptyState from '#lib/components/EmptyState.svelte';
  import PageContainer from '#lib/layout/PageContainer.svelte';
  import type {PageData} from './$types';

  let {data}: {data: PageData} = $props();

  const copy = $derived(
    data.state === 'confirmed' ?
      {
        title: 'Subscription confirmed',
        description:
          'You will get an email whenever a new article is published. Every email includes a one-click unsubscribe link.'
      }
    : data.state === 'unavailable' ?
      {
        title: 'Something went wrong',
        description:
          'The subscription could not be confirmed right now. Try the link again in a few minutes.'
      }
    : {
        title: 'This link is no longer valid',
        description:
          'Confirmation links can only be used once. Subscribe again to get a fresh link.'
      }
  );
</script>

<svelte:head>
  <title>Confirm subscription</title>
  <meta
    name="robots"
    content="noindex, nofollow" />
</svelte:head>

<PageContainer class="py-16">
  <EmptyState
    title={copy.title}
    description={copy.description}>
    {#snippet icon()}
      {#if data.state === 'confirmed'}
        <MailCheck class="size-7 text-success" />
      {:else if data.state === 'unavailable'}
        <TriangleAlert class="size-7 text-warning" />
      {:else}
        <MailX class="size-7" />
      {/if}
    {/snippet}
    {#snippet actions()}
      <Button
        type="secondary"
        size="sm"
        href="/">
        Back to the site
      </Button>
    {/snippet}
  </EmptyState>
</PageContainer>
