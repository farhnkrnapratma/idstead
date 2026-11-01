<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { Copyright } from '@lucide/svelte';
    import type { BannerCredit, ResolvedContentLicense } from '@idstead/domain/contentLicense.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import BannerCreditLine from './BannerCreditLine.svelte';

    interface Props {
        license: ResolvedContentLicense;
        bannerCredit: BannerCredit | null;
        hasBanner: boolean;
        class?: string;
    }

    let { license, bannerCredit, hasBanner, class: className = '' }: Props = $props();

    const credit = $derived(hasBanner ? bannerCredit : null);
    const exception = $derived(credit ? ', except the banner' : '');

    const linkClass =
        'rounded-xs underline decoration-line-strong underline-offset-2 transition-colors hover:text-fg-accent focus-visible:text-fg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';
</script>

<aside
    aria-label="License"
    class={cn(
        'flex gap-2 rounded-md border border-line-subtle bg-surface px-3 py-2.5 text-xs text-fg-secondary',
        className
    )}>
    <Copyright
        aria-hidden="true"
        class="mt-px size-3.5 shrink-0 text-fg-muted" />
    <div class="flex min-w-0 flex-col gap-1">
        {#if license.url}
            <p>
                Except where otherwise noted, this post is licensed under <a
                    href={license.url}
                    target="_blank"
                    rel="license noopener noreferrer"
                    title={license.name}
                    class={linkClass}>{license.label}</a
                >.
            </p>
        {:else}
            <p>All rights reserved{exception}.</p>
        {/if}
        {#if credit}
            <BannerCreditLine
                {credit}
                {linkClass} />
        {/if}
    </div>
</aside>
