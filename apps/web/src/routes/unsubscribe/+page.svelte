<script lang="ts">
    import { MailX, TriangleAlert } from '@lucide/svelte';
    import Button from '#lib/components/Button.svelte';
    import EmptyState from '#lib/components/EmptyState.svelte';
    import PageContainer from '#lib/layout/PageContainer.svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    const copy = $derived(
        data.state === 'unsubscribed' ?
            {
                title: 'You are unsubscribed',
                description:
                    'You will not receive any more article emails. You can subscribe again at any time from the site.'
            }
        : data.state === 'unavailable' ?
            {
                title: 'Something went wrong',
                description:
                    'The unsubscribe could not be processed right now. Try the link again in a few minutes.'
            }
        :   {
                title: 'This link is no longer valid',
                description:
                    'Use the unsubscribe link from a recent email, or contact the site owner.'
            }
    );
</script>

<svelte:head>
    <title>Unsubscribe</title>
    <meta
        name="robots"
        content="noindex, nofollow" />
</svelte:head>

<PageContainer class="py-16">
    <EmptyState
        title={copy.title}
        description={copy.description}
        icon={data.state === 'unavailable' ? TriangleAlert : MailX}
        iconClass={data.state === 'unavailable' ? 'text-warning' : ''}>
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
