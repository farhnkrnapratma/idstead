<script lang="ts">
    import { MailCheck, MailX, TriangleAlert } from '@lucide/svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import EmptyState from '@idstead/ui/components/EmptyState.svelte';
    import PageContainer from '@idstead/ui/layout/PageContainer.svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

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
        :   {
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

<main id="main">
    <h1 class="sr-only">Confirm subscription</h1>
    <PageContainer class="py-16">
        <EmptyState
            title={copy.title}
            description={copy.description}
            icon={data.state === 'confirmed' ? MailCheck
            : data.state === 'unavailable' ? TriangleAlert
            : MailX}
            iconClass={data.state === 'confirmed' ? 'text-success'
            : data.state === 'unavailable' ? 'text-warning'
            : ''}>
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
</main>
