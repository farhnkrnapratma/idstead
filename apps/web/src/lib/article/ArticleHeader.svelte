<script lang="ts">
    import type { Snippet } from 'svelte';
    import { Pilcrow } from '@lucide/svelte';
    import { avifSources, blogBannerAlt } from '#lib/blogBanner.ts';
    import ImageWithSkeleton from '@idstead/ui/components/ImageWithSkeleton.svelte';
    import { activateHeadingAnchor } from '@mdrs/dom/headingAnchors.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { contentFontStore } from '@idstead/ui/stores/contentFontStore.svelte.ts';

    interface Props {
        title: string;
        banner?: string;
        bannerAlt?: string;
        excerpt?: string;
        class?: string;
        titleClass?: string;
        titleViewTransitionName?: string;
        meta?: Snippet;
    }

    let {
        title,
        excerpt = '',
        banner = '',
        bannerAlt,
        class: className = '',
        titleClass = 'text-fg-secondary',
        titleViewTransitionName = '',
        meta
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

<header class={cn('article-header border-b border-b-line-subtle pb-4', className)}>
    {#if banner}<ImageWithSkeleton
            src={banner}
            sources={avifSources(banner)}
            alt={bannerAlt ?? blogBannerAlt(title, excerpt)}
            loading="eager"
            aspectRatio="aspect-2/1"
            class="mb-4 w-full" />{/if}
    <h1
        id="title"
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
                    >{titleParts.last}<a
                        href="#title"
                        aria-label="Permanent link"
                        data-tooltip="Permanent link"
                        class="mdrs-anchor"
                        onclick={event =>
                            activateHeadingAnchor(event.currentTarget as HTMLAnchorElement)}
                        tabindex="0">
                        <Pilcrow
                            class="inline-block size-[0.75em] align-middle leading-none text-inherit no-underline select-none"
                            aria-hidden="true" />
                    </a></span
                ></span>
        {:else}
            <span class="mdrs-heading-text inline whitespace-nowrap"
                >{titleParts.last}<a
                    href="#title"
                    aria-label="Permanent link"
                    data-tooltip="Permanent link"
                    class="mdrs-anchor"
                    onclick={event =>
                        activateHeadingAnchor(event.currentTarget as HTMLAnchorElement)}
                    tabindex="0">
                    <Pilcrow
                        class="inline-block size-[0.75em] align-middle leading-none text-inherit no-underline select-none"
                        aria-hidden="true" />
                </a></span>
        {/if}
    </h1>

    {#if excerpt}
        <p class={cn('font-content-' + contentFontStore.current, 'mt-2 text-base text-fg-muted')}>
            {excerpt}
        </p>
    {/if}

    {#if meta}
        <div class="mt-3">
            {@render meta()}
        </div>
    {/if}
</header>
