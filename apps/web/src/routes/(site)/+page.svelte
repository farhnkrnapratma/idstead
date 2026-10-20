<script lang="ts">
    import { onMount } from 'svelte';
    import { ChevronRight, FolderOpen, Quote } from '@lucide/svelte';
    import { Button, EmptyState, PageContainer, PageMain, Section } from '@idstead/ui';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import { argKey, buttonKey } from '@idstead/ui/shortcuts.ts';
    import { decodeHtmlEntities } from '@mdrs/core';
    import { goto } from '$app/navigation';
    import {
        avatarSources,
        avatarWebpSource,
        publicAvatarUrl,
        publicBannerOgUrl,
        siteBannerSource,
        siteBannerSources
    } from '#lib/siteIdentity.ts';
    import FooterSection from '#app/layout/FooterSection.svelte';
    import SubscribeForm from '#app/components/SubscribeForm.svelte';
    import BlogPostCard from '#app/components/BlogPostCard.svelte';
    import ProfileCard from '#app/components/ProfileCard.svelte';
    import QrCodeDialog from '#app/components/QrCodeDialog.svelte';
    import CvDownloadMenu from '#app/components/CvDownloadMenu.svelte';
    import CvEntryList from '#app/components/CvEntryList.svelte';
    import ProjectCard from '#app/components/ProjectCard.svelte';
    import { isRepoNew, isRepoPinned, recentlyPushed } from '#app/projectLists.ts';
    import { legacySectionPath } from '#app/siteSections.ts';

    let { data } = $props();

    const HOME_PROJECT_COUNT = 2;

    const author = $derived(data.author);
    const name = $derived(author?.name || '');
    const pronunciation = $derived(author?.pronunciation || '');
    const username = $derived(author?.username || '');
    const desc = $derived(author?.bio || '');
    const headline = $derived(author?.headline || '');
    const jobTitle = $derived(author?.jobTitle || '');
    const siteUrl = $derived(author?.siteUrl || '');
    const ogBanner = $derived(publicBannerOgUrl(author));
    const ogImage = $derived(ogBanner || publicAvatarUrl(author));
    const ogImageType = $derived(ogBanner ? 'image/webp' : 'image/png');
    const ogImageWidth = $derived(ogBanner ? '1200' : '512');
    const ogImageHeight = $derived(ogBanner ? '630' : '512');
    const avatar = $derived(author?.avatar || '');
    const avatarWebp = $derived(avatarWebpSource(author) || avatar);
    const avatarFormats = $derived(avatarSources(author));
    const socials = $derived(author?.socialLinks || []);
    const location = $derived([author?.city, author?.country].filter(Boolean).join(', '));
    let isQrOpen = $state(false);

    const posts = $derived(data.posts || []);
    const projects = $derived(data.projects || []);
    const pinnedRepoNames = $derived(
        (data.pinnedRepoNames || []).map((n: string) => n.toLowerCase())
    );
    const recentProjects = $derived(recentlyPushed(projects, pinnedRepoNames, HOME_PROJECT_COUNT));

    onMount(() => {
        const legacyPath = legacySectionPath(window.location.hash);
        if (legacyPath) void goto(legacyPath, { replace: true });
    });

    const jsonLdScript = $derived(
        JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: name,
            url: siteUrl,
            image: ogImage,
            sameAs: Object.values(author?.socials || {}).filter(Boolean),
            jobTitle: jobTitle,
            description: desc
        }).replace(/</g, '\\u003c')
    );
</script>

<svelte:head>
    <title>{name}{headline ? ` · ${headline}` : ''}</title>
    <meta
        name="description"
        content={desc} />
    <meta
        name="robots"
        content="index, follow" />
    <link
        rel="canonical"
        href={siteUrl} />
    <meta
        property="og:title"
        content="{name} · {headline}" />
    <meta
        property="og:description"
        content={desc} />
    <meta
        property="og:type"
        content="profile" />
    <meta
        property="og:url"
        content={siteUrl} />
    <meta
        property="og:site_name"
        content={name} />
    <meta
        property="og:image"
        content={ogImage} />
    <meta
        property="og:image:secure_url"
        content={ogImage} />
    <meta
        property="og:image:type"
        content={ogImageType} />
    <meta
        property="og:image:width"
        content={ogImageWidth} />
    <meta
        property="og:image:height"
        content={ogImageHeight} />
    <meta
        property="og:image:alt"
        content="{name} · {desc}" />
    <meta
        property="og:locale"
        content="en_US" />
    <meta
        property="profile:username"
        content={username} />
    <meta
        property="profile:gender"
        content="male" />
    <meta
        name="twitter:image"
        content={ogImage} />
    <meta
        name="twitter:card"
        content="summary_large_image" />
    <meta
        name="twitter:title"
        content="{name} · {headline}" />
    <meta
        name="twitter:description"
        content={desc} />
    <script
        type="application/ld+json"
        {@attach (node: HTMLScriptElement) => {
            node.textContent = jsonLdScript;
        }}></script>
</svelte:head>

{#snippet staticTag(tag: string)}
    <Tag
        variant="accent"
        class="font-mono">{decodeHtmlEntities(tag)}</Tag>
{/snippet}

<PageMain variant="site">
    <Section
        spacing="none"
        class="relative z-10 pt-4 pb-6 sm:pt-5 md:pt-10 md:pb-8 toolbar-gutter:pt-0">
        <PageContainer
            width="standard"
            class="flex flex-col gap-4 sm:gap-5">
            <ProfileCard
                {name}
                {pronunciation}
                {headline}
                {jobTitle}
                {location}
                bio={desc}
                avatarUrl={avatarWebp}
                avatarSources={avatarFormats}
                bannerUrl={siteBannerSource(author)}
                bannerSources={siteBannerSources(author)}
                {socials}
                onShowQr={() => (isQrOpen = true)}>
                {#snippet actions()}
                    <div
                        class="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(calc(10rem*var(--a11y-scale)),1fr))]">
                        <CvDownloadMenu
                            document={data.cvDocument}
                            shortcutGroup="save"
                            shortcutChordKey={argKey('/save', 'cv')}
                            class="w-full" />

                        <Button
                            type="secondary"
                            size="md"
                            href="/projects"
                            keyboardShortcut={buttonKey('browseProjects')}
                            shortcutLabel="Browse projects"
                            class="w-full justify-center">
                            Browse projects
                        </Button>

                        <Button
                            type="ghost"
                            size="md"
                            href="/contact"
                            keyboardShortcut={buttonKey('getInTouch')}
                            shortcutLabel="Get in touch"
                            class="w-full justify-center">
                            Get in touch
                            {#snippet trailing()}
                                <ChevronRight
                                    class="size-3"
                                    aria-hidden="true" />
                            {/snippet}
                        </Button>
                    </div>
                {/snippet}
            </ProfileCard>

            <div>
                <h2 class="mb-4 type-section-title">Experience</h2>
                <CvEntryList
                    kind="experience"
                    entries={data.experience} />
            </div>

            <div>
                <h2 class="mb-4 type-section-title">Education</h2>
                <CvEntryList
                    kind="education"
                    entries={data.education} />
                <div class="mt-4 flex justify-end">
                    <Button
                        type="ghost"
                        size="sm"
                        href="/cv"
                        keyboardShortcut={buttonKey('viewFullCv')}
                        shortcutLabel="View full CV"
                        aria-label="View full CV including education and experience">
                        <span class="leading-none">View full CV</span>
                        {#snippet trailing()}
                            <ChevronRight class="size-3" />
                        {/snippet}
                    </Button>
                </div>
            </div>

            <div>
                <h2 class="mb-3 type-section-title sm:mb-4">Recent Posts</h2>
                {#if posts.length === 0}
                    <EmptyState
                        icon={Quote}
                        title="No posts yet"
                        description="Check back soon for new articles." />
                {:else}
                    <div class="mt-2 grid auto-rows-fr grid-cols-1 gap-3 sm:gap-4">
                        {#each posts as post (post.id)}
                            <BlogPostCard {post} />
                        {/each}
                    </div>
                {/if}
                {#if posts.length > 0}
                    <div class="mt-4 flex justify-end">
                        <Button
                            href="/blog"
                            type="ghost"
                            size="sm"
                            keyboardShortcut={buttonKey('viewAllPosts')}
                            shortcutLabel="View all posts">
                            View all posts
                            {#snippet trailing()}<ChevronRight class="size-3" />{/snippet}
                        </Button>
                    </div>
                {/if}
                <SubscribeForm class="mt-4" />
            </div>

            <div>
                <h2 class="mb-3 type-section-title sm:mb-4">Recent Projects</h2>
                {#if recentProjects.length === 0}
                    <EmptyState
                        icon={FolderOpen}
                        title="No projects yet"
                        description="Check back soon for featured repositories." />
                {:else}
                    <div class="mt-2 grid auto-rows-fr grid-cols-1 gap-3 sm:gap-4">
                        {#each recentProjects as project (project.name)}
                            <ProjectCard
                                {project}
                                pinned={isRepoPinned(project, pinnedRepoNames)}
                                isNew={isRepoNew(project)}
                                tagItem={staticTag} />
                        {/each}
                    </div>
                {/if}
                {#if projects.length > 0}
                    <div class="mt-3 flex justify-end sm:mt-4">
                        <Button
                            type="ghost"
                            size="sm"
                            href="/projects"
                            keyboardShortcut={buttonKey('viewAllProjects')}
                            shortcutLabel="View all projects">
                            View all projects
                            {#snippet trailing()}<ChevronRight class="size-3" />{/snippet}
                        </Button>
                    </div>
                {/if}
            </div>
        </PageContainer>
    </Section>

    <FooterSection divided />
</PageMain>

<QrCodeDialog
    bind:isOpen={isQrOpen}
    title={name}
    url={siteUrl}
    slug={username || 'profile'}
    avatarUrl={avatarWebp}
    onClose={() => (isQrOpen = false)} />
