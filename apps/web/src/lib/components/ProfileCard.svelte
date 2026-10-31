<script lang="ts">
    import type { Snippet } from 'svelte';
    import { AudioLines, BadgeCheck, BriefcaseBusiness, MapPin, QrCode } from '@lucide/svelte';
    import type { ImageSource } from '@idstead/ui/types.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';

    import BrandIcon from '#lib/components/BrandIcon.svelte';
    import IconButton from '@idstead/ui/components/IconButton.svelte';
    import ImageWithSkeleton from '@idstead/ui/components/ImageWithSkeleton.svelte';

    interface SocialLink {
        url: string;
        platform: string;
        icon: string;
    }

    interface Props {
        name: string;
        pronunciation?: string;
        headline?: string;
        jobTitle?: string;
        location?: string;
        bio?: string;
        avatarUrl?: string;
        avatarSources?: ImageSource[];
        bannerUrl?: string;
        bannerSources?: ImageSource[];
        socials?: SocialLink[];
        headingTag?: 'h1' | 'h2';
        class?: string;
        onShowQr?: () => void;
        actions?: Snippet;
    }

    let {
        name,
        pronunciation = '',
        headline = '',
        jobTitle = '',
        location = '',
        bio = '',
        avatarUrl = '',
        avatarSources,
        bannerUrl = '',
        bannerSources,
        socials = [],
        headingTag = 'h1',
        class: className = '',
        onShowQr,
        actions
    }: Props = $props();

    let bannerFailed = $state(false);
</script>

<div
    class={cn(
        'profile-card relative w-full overflow-hidden rounded-md glass-card text-left',
        className
    )}>
    <div class="aspect-3/1 w-full bg-accent-subtle sm:aspect-40/9">
        {#if bannerUrl && !bannerFailed}
            <ImageWithSkeleton
                src={bannerUrl}
                sources={bannerSources}
                alt=""
                rounded=""
                loading="eager"
                fetchpriority="high"
                onerror={() => (bannerFailed = true)}
                class="h-full w-full" />
        {/if}
    </div>

    <div class="px-4 pb-5 sm:px-6 sm:pb-6">
        <div class="profile-avatar relative -mt-12 w-fit rounded-md sm:-mt-14">
            {#if avatarUrl}
                <ImageWithSkeleton
                    src={avatarUrl}
                    sources={avatarSources}
                    alt={`Profile picture of ${name}`}
                    referrerpolicy="no-referrer"
                    loading="eager"
                    variant="avatar"
                    rounded="rounded-md"
                    class="size-24 shadow-md ring-4 ring-surface sm:size-28"
                    imgClass="object-top" />
            {:else}
                <div
                    class="flex size-24 items-center justify-center rounded-md bg-surface-subtle text-3xl font-bold text-fg-accent shadow-md ring-4 ring-surface sm:size-28 sm:text-4xl"
                    aria-hidden="true">
                    {name.charAt(0)}
                </div>
            {/if}

            {#if onShowQr}
                <div class="absolute right-0 bottom-0 flex sm:right-0.5 sm:bottom-0.5">
                    <IconButton
                        variant="overlay"
                        size="sm"
                        ariaLabel="Show QR code"
                        tooltipPlacement="top"
                        onclick={onShowQr}
                        class="ring-4 ring-surface">
                        <QrCode
                            class="size-4"
                            aria-hidden="true" />
                    </IconButton>
                </div>
            {/if}
        </div>

        {#if name}
            <svelte:element
                this={headingTag}
                class="mt-3 type-page-title font-extrabold sm:text-4xl">
                {name}
            </svelte:element>
        {/if}

        {#if headline}
            <p class="mt-1 type-body text-fg-secondary">{headline}</p>
        {/if}

        {#if pronunciation || jobTitle || location}
            <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                {#if pronunciation}
                    <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <AudioLines
                            class="size-3.5 shrink-0"
                            aria-hidden="true" />
                        <span class="tracking-wide">{pronunciation}</span>
                    </span>
                {/if}
                {#if jobTitle}
                    <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <BriefcaseBusiness
                            class="size-3.5 shrink-0"
                            aria-hidden="true" />
                        {jobTitle}
                    </span>
                {/if}
                {#if location}
                    <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <MapPin
                            class="size-3.5 shrink-0"
                            aria-hidden="true" />
                        {location}
                    </span>
                {/if}
            </div>
        {/if}

        {#if socials.length > 0}
            <div
                class="mt-4 flex flex-wrap items-center gap-1 select-none sm:gap-1.5 pointer-coarse:gap-2">
                <span
                    class="mr-0.5 inline-flex h-8 items-center gap-2"
                    aria-hidden="true">
                    <BadgeCheck class="size-4.5 fill-accent text-on-accent sm:size-5" />
                    <span class="text-fg-muted">—</span>
                </span>
                {#each socials as item (item.url + item.platform)}
                    <IconButton
                        variant="ghost"
                        size="sm"
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        ariaLabel={item.platform}
                        tooltipPlacement="top"
                        shortcutGroup="social">
                        <BrandIcon
                            icon={item.icon}
                            class="text-sm leading-none sm:text-base" />
                    </IconButton>
                {/each}
            </div>
        {/if}

        {#if bio}
            <p class="mt-4 type-body text-pretty text-fg-secondary">{bio}</p>
        {/if}

        {#if actions}
            <div class="mt-5">
                {@render actions()}
            </div>
        {/if}
    </div>
</div>

<style>
    @keyframes profile-rise {
        from {
            transform: translateY(8px);
        }
        to {
            transform: none;
        }
    }

    @keyframes profile-avatar-in {
        from {
            transform: scale(0.94);
            filter: blur(6px);
        }
        to {
            transform: none;
            filter: none;
        }
    }

    .profile-card {
        animation: profile-rise 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .profile-avatar {
        animation: profile-avatar-in 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
</style>
