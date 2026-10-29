<script lang="ts">
    import type { Snippet } from 'svelte';
    import { Link2, Pilcrow } from '@lucide/svelte';
    import { page } from '$app/state';
    import { activateHeadingAnchor, copyHeadingLink } from '@mdrs/dom/headingAnchors.ts';
    import { announceLinkCopy } from './articleHash.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';

    interface Props {
        title: string;
        excerpt?: string;
        class?: string;
        titleClass?: string;
        titleViewTransitionName?: string;
        meta?: Snippet;
        onPermalink?: () => void;
    }

    let {
        title,
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

{#snippet permalink()}<a
        href={page.url.pathname}
        aria-label="Permanent link"
        data-tooltip="Permanent link"
        class="mdrs-anchor"
        onclick={event => {
            event.preventDefault();
            activateHeadingAnchor(event.currentTarget);
            onPermalink?.();
        }}
        tabindex="0">
        <Pilcrow
            class="inline-block size-[0.75em] align-middle leading-none text-inherit no-underline select-none"
            aria-hidden="true" />
    </a>{/snippet}

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
        <button
            type="button"
            class="mdrs-copy-link"
            aria-label="Copy link to this page"
            data-tooltip="Copy link"
            onclick={event =>
                copyHeadingLink(
                    event.currentTarget,
                    `${page.url.origin}${page.url.pathname}`,
                    announceLinkCopy
                )}>
            <Link2 aria-hidden="true" />
        </button>
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
