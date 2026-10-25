<script lang="ts">
    import { onMount } from 'svelte';
    import { Check, ShieldCheck } from '@lucide/svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import Card from '@idstead/ui/components/Card.svelte';
    import ErrorState from '@idstead/ui/components/ErrorState.svelte';
    import LoadingState from '@idstead/ui/components/LoadingState.svelte';
    import SkipLink from '@idstead/ui/components/SkipLink.svelte';
    import { toastStore } from '@idstead/ui/stores/toastStore.svelte.ts';
    import { adminRequest } from '#app/adminClient.ts';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    let deciding = $state<'allow' | 'deny' | null>(null);

    onMount(() => {
        if (data.outcome.kind === 'redirect') window.location.replace(data.outcome.url);
    });

    async function decide(decision: 'allow' | 'deny') {
        deciding = decision;
        try {
            const result = await adminRequest<{ redirect: string }>('oidc/authorize', {
                body: { query: data.query, decision }
            });
            window.location.assign(result.redirect);
        } catch (error) {
            deciding = null;
            toastStore.error(
                error instanceof Error ? error.message : 'The decision could not be saved.'
            );
        }
    }
</script>

<svelte:head>
    <title>Sign in with Idstead</title>
</svelte:head>

<SkipLink />

<main
    id="main"
    class="flex min-h-dvh items-center justify-center px-4 py-10 font-sans">
    {#if data.outcome.kind === 'redirect'}
        <LoadingState
            variant="spinner"
            label="Returning to the app..." />
    {:else if data.outcome.kind === 'fatal'}
        <div class="flex w-full max-w-sm flex-col items-center gap-4">
            <ErrorState
                title="Can't continue the sign-in"
                description={data.outcome.message} />
            <Button
                type="secondary"
                size="sm"
                href="/">
                Back to admin
            </Button>
        </div>
    {:else}
        {@const outcome = data.outcome}
        <Card class="flex w-full max-w-sm flex-col gap-5">
            <div class="flex flex-col gap-2">
                <div
                    class="flex size-10 items-center justify-center rounded-md bg-surface-hover text-fg-secondary">
                    <ShieldCheck class="size-5" />
                </div>
                <h1 class="type-card-title text-lg">
                    {outcome.client.name} wants to sign you in
                </h1>
                <p class="type-body text-fg-secondary">
                    You will be sent back to <span class="font-mono text-fg"
                        >{outcome.client.host}</span>
                    with the details below.
                </p>
            </div>

            <ul class="flex flex-col gap-3">
                {#each outcome.scopes as item (item.scope)}
                    <li class="flex gap-3">
                        <Check class="mt-0.5 size-4 shrink-0 text-success" />
                        <div class="flex flex-col gap-0.5">
                            <span class="text-sm font-semibold text-fg">{item.label}</span>
                            <span class="text-xs text-fg-muted">{item.claims.join(', ')}</span>
                        </div>
                    </li>
                {/each}
            </ul>

            <p class="text-xs text-fg-muted">
                You can revoke this at any time under Connected apps.
            </p>

            <div class="flex justify-end gap-2">
                <Button
                    type="secondary"
                    size="sm"
                    isLoading={deciding === 'deny'}
                    disabled={deciding !== null}
                    onclick={() => decide('deny')}>
                    Deny
                </Button>
                <Button
                    type="primary"
                    size="sm"
                    isLoading={deciding === 'allow'}
                    disabled={deciding !== null}
                    onclick={() => decide('allow')}>
                    Allow
                </Button>
            </div>
        </Card>
    {/if}
</main>
