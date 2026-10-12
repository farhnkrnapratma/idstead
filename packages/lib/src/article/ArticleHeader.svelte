<script lang="ts">
    import type { Snippet } from 'svelte';
    import { Pilcrow } from '@lucide/svelte';
    import { blogBannerAlt } from '../blogBanner';
    import ImageWithSkeleton from '../components/ImageWithSkeleton.svelte';
    import { activateHeadingAnchor } from '../utils/headingAnchors';
    import { cn } from '../utils/cn';
    import { contentFontStore } from '../stores/contentFontStore.svelte';

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
        titleClass = 'text-text-secondary',
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

<header class={cn('article-header border-b border-b-border-subtle pb-4', className)}>
    {#if banner}<ImageWithSkeleton
            src={banner}
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
            'heading-anchor scroll-mt-20',
            'text-lg leading-snug font-bold tracking-tight not-italic sm:text-3xl md:text-4xl [&_.heading-text]:font-bold [&_.heading-text]:not-italic',
            titleClass
        )}>
        {#if titleParts.hasMultiple}
            <span class="heading-text inline"
                >{titleParts.leading}&nbsp;<span class="whitespace-nowrap"
                    >{titleParts.last}<a
                        href="#title"
                        aria-label="Permanent link"
                        data-tooltip="Permanent link"
                        class="anchor-link"
                        onclick={event =>
                            activateHeadingAnchor(event.currentTarget as HTMLAnchorElement)}
                        tabindex="0">
                        <Pilcrow
                            strokeWidth={1.25}
                            class="inline-block size-[0.75em] align-middle leading-none text-inherit no-underline select-none"
                            aria-hidden="true" />
                    </a></span
                ></span>
        {:else}
            <span class="heading-text inline whitespace-nowrap"
                >{titleParts.last}<a
                    href="#title"
                    aria-label="Permanent link"
                    data-tooltip="Permanent link"
                    class="anchor-link"
                    onclick={event =>
                        activateHeadingAnchor(event.currentTarget as HTMLAnchorElement)}
                    tabindex="0">
                    <Pilcrow
                        strokeWidth={1.25}
                        class="inline-block size-[0.75em] align-middle leading-none text-inherit no-underline select-none"
                        aria-hidden="true" />
                </a></span>
        {/if}
    </h1>

    {#if excerpt}
        <p class={cn('font-content-' + contentFontStore.current, 'mt-2 text-base text-text-muted')}>
            {excerpt}
        </p>
    {/if}

    {#if meta}
        <div class="mt-3">
            {@render meta()}
        </div>
    {/if}
</header>
