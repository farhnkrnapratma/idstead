<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { ImageSource } from '../blogBanner';
    import { cn } from '../utils/cn';

    import BrandIcon from './BrandIcon.svelte';
    import Button from './Button.svelte';
    import ImageWithSkeleton from './ImageWithSkeleton.svelte';

    interface SocialLink {
        url: string;
        platform: string;
        icon: string;
    }

    interface Props {
        name: string;
        pronunciation?: string;
        headline?: string;
        bio?: string;
        avatarUrl?: string;
        avatarSources?: ImageSource[];
        socials?: SocialLink[];
        headingTag?: 'h1' | 'h2';
        class?: string;
        actions?: Snippet;
    }

    let {
        name,
        pronunciation = '',
        headline = '',
        bio = '',
        avatarUrl = '',
        avatarSources,
        socials = [],
        headingTag = 'h1',
        class: className = '',
        actions
    }: Props = $props();
</script>

<div
    class={cn(
        'profile-card @container relative isolate mt-10 flex w-full flex-col items-center rounded-md glass-card px-4 pb-5 text-center sm:mt-12 sm:px-6 sm:pb-6',
        className
    )}>
    <div
        class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 rounded-t-md bg-radial-[at_50%_0%] from-accent/12 to-transparent to-70%"
        aria-hidden="true">
    </div>

    <div class="profile-avatar -mt-10 rounded-full sm:-mt-12">
        {#if avatarUrl}
            <ImageWithSkeleton
                src={avatarUrl}
                sources={avatarSources}
                alt={`Profile picture of ${name}`}
                referrerpolicy="no-referrer"
                loading="eager"
                fetchpriority="high"
                variant="avatar"
                rounded="rounded-full"
                class="size-20 shadow-md ring-4 ring-surface-base sm:size-24"
                imgClass="object-top" />
        {:else}
            <div
                class="flex size-20 items-center justify-center rounded-full bg-surface-subtle text-2xl font-bold text-accent-text shadow-md ring-4 ring-surface-base sm:size-24 sm:text-4xl"
                aria-hidden="true">
                {name.charAt(0)}
            </div>
        {/if}
    </div>

    <svelte:element
        this={headingTag}
        class="mt-3 max-w-full type-page-title font-extrabold sm:text-4xl">
        {name}
    </svelte:element>

    {#if pronunciation}
        <p class="mt-1 text-xs tracking-wide text-text-muted">{pronunciation}</p>
    {/if}

    {#if headline}
        <p class="mt-2 max-w-2xl type-body text-balance text-text-primary">
            {headline}
        </p>
    {/if}

    {#if bio}
        <p
            class="mt-4 max-w-2xl type-body text-pretty text-text-secondary sm:mt-5 @2xl:text-base @2xl:leading-relaxed">
            {bio}
        </p>
    {/if}

    {#if actions}
        <div class="mt-5 w-full sm:mt-6">
            {@render actions()}
        </div>
    {/if}

    {#if socials.length > 0}
        <div
            class="mt-4 flex flex-wrap items-center justify-center gap-1 select-none sm:mt-5 sm:gap-1.5">
            {#each socials as item (item.url + item.platform)}
                <Button
                    type="ghost"
                    size="2xs"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.platform}
                    title={item.platform}
                    shortcutGroup="social"
                    shortcutLabel={item.platform}
                    class="size-7.5! rounded-md! border-0! bg-transparent! p-0! text-text-muted transition-colors hover:bg-surface-hover hover:text-accent-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:size-8!">
                    <BrandIcon
                        icon={item.icon}
                        class="text-sm leading-none sm:text-base" />
                </Button>
            {/each}
        </div>
    {/if}
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
