<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

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
    <p class="text-xs text-fg-secondary">
        By {action}, you agree to our
        {#if showTerms}
            <a
                href="/terms"
                class="text-fg-accent underline hover:text-accent-hover">Terms of Service</a>
        {/if}
        {#if showTerms && showPrivacy}
            and
        {/if}
        {#if showPrivacy}
            <a
                href="/privacy"
                class="text-fg-accent underline hover:text-accent-hover">Privacy Policy</a>
        {/if}.
    </p>
{/if}
