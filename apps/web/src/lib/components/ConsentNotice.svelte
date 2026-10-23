<script lang="ts">
    import { isHiddenLegalPath } from '#app/legalVisibility.ts';

    interface Props {
        action: string;
    }

    let { action }: Props = $props();

    const showTerms = $derived(!isHiddenLegalPath('/terms'));
    const showPrivacy = $derived(!isHiddenLegalPath('/privacy'));
</script>

{#if showTerms || showPrivacy}
    <p class="text-xs text-text-secondary">
        By {action}, you agree to our
        {#if showTerms}
            <a
                href="/terms"
                class="text-accent-text underline hover:text-accent-hover">Terms of Service</a>
        {/if}
        {#if showTerms && showPrivacy}
            and
        {/if}
        {#if showPrivacy}
            <a
                href="/privacy"
                class="text-accent-text underline hover:text-accent-hover">Privacy Policy</a>
        {/if}.
    </p>
{/if}
