<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { ImageSource } from '../blogBanner';
    import { cn } from '../utils/cn';

    import BrandIcon from './BrandIcon.svelte';
    import Button from './Button.svelte';
    import ImageWithSkeleton from './ImageWithSkeleton.svelte';
    import Tag from './Tag.svelte';

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

    const headlineParts = $derived(
        headline
            .split('|')
            .map(part => part.trim())
            .filter(Boolean)
    );
</script>

<div
    class={cn(
        'profile-card relative isolate mt-12 flex w-full flex-col items-center rounded-md glass-card px-3 pb-5 text-center sm:mt-16 sm:px-8 sm:pb-7',
        className
    )}>
    <div
        class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 rounded-t-md bg-radial-[at_50%_0%] from-accent/12 to-transparent to-70%"
        aria-hidden="true">
    </div>

    <div class="profile-avatar -mt-11 rounded-full sm:-mt-16">
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
                class="size-20 shadow-md ring-4 ring-surface-base sm:size-28"
                imgClass="object-top" />
        {:else}
            <div
                class="flex size-20 items-center justify-center rounded-full bg-surface-subtle text-2xl font-bold text-accent-text shadow-md ring-4 ring-surface-base sm:size-28 sm:text-4xl"
                aria-hidden="true">
                {name.charAt(0)}
            </div>
        {/if}
    </div>

    <svelte:element
        this={headingTag}
        class="mt-3 max-w-full type-page-title font-extrabold sm:mt-4 sm:text-4xl">
        {name}
    </svelte:element>

    {#if pronunciation}
        <p class="mt-1 text-xs text-text-muted sm:text-sm">{pronunciation}</p>
    {/if}

    {#if headlineParts.length > 0}
        <ul
            role="list"
            class="mt-3 flex max-w-xl flex-wrap items-center justify-center gap-1 sm:mt-4 sm:gap-1.5">
            {#each headlineParts as part, i (i)}
                <li>
                    <Tag
                        variant="subtle"
                        size="md"
                        class="font-medium whitespace-nowrap text-text-secondary max-sm:px-2 max-sm:py-0.5 max-sm:text-xs"
                        >{part}</Tag>
                </li>
            {/each}
        </ul>
    {/if}

    {#if bio}
        <p class="mt-3 max-w-lg type-body text-pretty text-text-secondary sm:mt-4">{bio}</p>
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

    {#if actions}
        <div class="mt-4 w-full sm:mt-6">
            {@render actions()}
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
