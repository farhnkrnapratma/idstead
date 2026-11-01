<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { page } from '$app/state';
    import type { ResolvedContentLicense } from '@idstead/domain/contentLicense.ts';

    const contentLicense = $derived(page.data.contentLicense as ResolvedContentLicense | undefined);
    const postNoticeShown = $derived(Boolean(page.data.license));
    const sourceUrl = $derived(page.data.sourceUrl as string | null | undefined);

    const linkClass =
        'rounded-xs underline decoration-line-strong underline-offset-2 transition-colors hover:text-fg-accent focus-visible:text-fg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';
</script>

<ul
    class="flex flex-col gap-1 border-t border-line-subtle pt-4 text-xs font-medium text-fg-muted sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pt-5">
    {#if contentLicense?.url}
        <li>
            Except where otherwise noted, original content on this site is licensed under
            <a
                href={contentLicense.url}
                target="_blank"
                rel={postNoticeShown ? 'noopener noreferrer' : 'license noopener noreferrer'}
                title={contentLicense.name}
                class={linkClass}>{contentLicense.label}</a
            >.
        </li>
    {:else if contentLicense}
        <li>{contentLicense.label}, except where otherwise noted.</li>
    {/if}
    {#if sourceUrl}
        <li class="sm:ml-auto sm:shrink-0">
            <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Idstead source code, AGPL-3.0"
                class={linkClass}>Source</a>
            (AGPL-3.0)
        </li>
    {/if}
</ul>
