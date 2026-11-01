<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { page } from '$app/state';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import HeadingActions from './HeadingActions.svelte';

    interface Props {
        title: string;
        slug: string;
        excerpt?: string;
        class?: string;
        titleClass?: string;
        titleViewTransitionName?: string;
        meta?: Snippet;
        onPermalink?: () => void;
    }

    let {
        title,
        slug,
        excerpt = '',
        class: className = '',
        titleClass = 'text-fg-secondary',
        titleViewTransitionName = '',
        meta,
        onPermalink
    }: Props = $props();

    let titleParts = $derived.by(() => {
        const words = title.trim().split(/\s+/);
        if (words.length > 1) {
            return {
                hasMultiple: true,
                leading: words.slice(0, -1).join(' '),
                last: words[words.length - 1]
            };
        }
        return { hasMultiple: false, leading: '', last: title };
    });
</script>

{#snippet permalink()}<span class="mdrs-heading-actions"
        ><HeadingActions
            href={page.url.pathname}
            url="{page.url.origin}{page.url.pathname}"
            {title}
            qrSlug={slug}
            scope="page"
            {onPermalink} /></span
    >{/snippet}

<header class={cn('article-header border-b border-b-line-subtle pb-4', className)}>
    <h1
        style={titleViewTransitionName ?
            `view-transition-name: ${titleViewTransitionName}`
        :   undefined}
        class={cn(
            'mdrs-heading',
            'text-2xl leading-snug font-bold tracking-tight not-italic sm:text-3xl md:text-4xl [&_.mdrs-heading-text]:font-bold [&_.mdrs-heading-text]:not-italic',
            titleClass
        )}>
        {#if titleParts.hasMultiple}
            <span class="mdrs-heading-text inline"
                >{titleParts.leading}&nbsp;<span class="whitespace-nowrap"
                    >{titleParts.last}{@render permalink()}</span
                ></span>
        {:else}
            <span class="mdrs-heading-text inline whitespace-nowrap"
                >{titleParts.last}{@render permalink()}</span>
        {/if}
    </h1>

    {#if excerpt}
        <p class="mt-2 text-base text-fg-muted">
            {excerpt}
        </p>
    {/if}

    {#if meta}
        <div class="mt-3">
            {@render meta()}
        </div>
    {/if}
</header>
