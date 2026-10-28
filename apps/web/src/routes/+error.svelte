<script lang="ts">
    import { page } from '$app/state';
    import { House, MessageSquareWarning } from '@lucide/svelte';
    import { Button, ErrorState } from '@idstead/ui';

    let errorTitle = $derived.by(() => {
        switch (page.status) {
            case 400:
                return 'Bad request';
            case 401:
                return 'Authentication required';
            case 403:
                return 'Access denied';
            case 404:
                return 'Page not found';
            case 408:
                return 'Request timed out';
            case 429:
                return 'Too many requests';
            case 500:
                return 'Something went wrong';
            case 502:
                return 'Bad gateway';
            case 503:
                return 'Service unavailable';
            case 504:
                return 'Gateway timeout';
            default:
                return 'An error occurred';
        }
    });

    let errorDescription = $derived.by(() => {
        switch (page.status) {
            case 400:
                return 'The request could not be processed. Please check the link or try again.';
            case 401:
                return 'You need to sign in before continuing.';
            case 403:
                return 'You do not have permission to view this page.';
            case 404:
                return 'The page you’re looking for doesn’t exist or may have been moved.';
            case 408:
                return 'The request took too long to complete. Please try again.';
            case 429:
                return 'You’ve made too many requests. Please wait a moment and try again.';
            case 500:
                return 'Something went wrong on our side. Please try again in a moment.';
            case 502:
                return 'The server received an invalid response from an upstream service.';
            case 503:
                return 'The service is temporarily unavailable. Please try again shortly.';
            case 504:
                return 'The server did not respond in time. Please try again shortly.';
            default:
                return page.error?.message || 'Something went wrong on our end. Please try again.';
        }
    });
</script>

<div class="flex min-h-screen flex-col">
    <main
        id="main"
        class="my-auto grid place-items-center px-6 py-16 font-sans sm:py-24 lg:px-8">
        <ErrorState
            size="page"
            code={page.status}
            title={errorTitle}
            description={errorDescription}>
            {#snippet actions()}
                <Button
                    type="primary"
                    size="md"
                    onclick={() => {
                        window.location.href = '/';
                    }}>
                    {#snippet leading()}
                        <House class="size-3.5" />
                    {/snippet}
                    Home
                </Button>
                <a href="/feedback">
                    <Button
                        type="secondary"
                        size="md">
                        {#snippet leading()}
                            <MessageSquareWarning class="size-3.5" />
                        {/snippet}
                        Feedback
                    </Button>
                </a>
            {/snippet}
        </ErrorState>
    </main>
</div>
