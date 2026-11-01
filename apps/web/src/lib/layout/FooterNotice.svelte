<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { page } from '$app/state';
    import type { ResolvedContentLicense } from '@idstead/domain/contentLicense.ts';

    interface Props {
        copyright: string;
    }

    let { copyright }: Props = $props();

    const contentLicense = $derived(page.data.contentLicense as ResolvedContentLicense | undefined);
    const sourceUrl = $derived(page.data.sourceUrl as string | null | undefined);

    const linkClass =
        'rounded-xs underline decoration-line-strong underline-offset-2 transition-colors hover:text-fg-accent focus-visible:text-fg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';
</script>

<div class="flex flex-col gap-1 text-xs font-medium text-fg-muted sm:items-end">
    <span class="select-none">{copyright}</span>
    <ul class="flex flex-col gap-1 sm:items-end sm:text-right">
        {#if contentLicense?.url}
            <li>
                Except where otherwise noted, content is licensed under <a
                    href={contentLicense.url}
                    target="_blank"
                    rel="license noopener noreferrer"
                    title={contentLicense.name}
                    class={linkClass}>{contentLicense.label}</a
                >.
            </li>
        {:else if contentLicense}
            <li>{contentLicense.label}.</li>
        {/if}
        {#if sourceUrl}
            <li>
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
</div>
