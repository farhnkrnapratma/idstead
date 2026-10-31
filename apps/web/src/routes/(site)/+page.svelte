<script lang="ts">
    import AuthorOgImage from '#app/components/AuthorOgImage.svelte';
    import { ChevronRight, FolderOpen, Quote, Sprout } from '@lucide/svelte';
    import { page } from '$app/state';
    import { newsletterSignupVisible } from '@idstead/domain/newsletter.ts';
    import { Button, EmptyState, PageContainer, PageMain, Section } from '@idstead/ui';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import { argKey, buttonKey } from '@idstead/ui/shortcuts.ts';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { decodeHtmlEntities } from '@mdrs/core';
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
    import ContentCard from '#app/components/ContentCard.svelte';
    import ProjectMeta from '#app/components/ProjectMeta.svelte';
    import ProjectLanguageTag from '#app/components/ProjectLanguageTag.svelte';
    import ArticleMeta from '#lib/article/ArticleMeta.svelte';
    import { postCard, postCardMeta, projectCard } from '#app/contentCards.ts';
    import ProfileCard from '#app/components/ProfileCard.svelte';
    import QrCodeDialog from '#app/components/QrCodeDialog.svelte';
    import ResumeDownloadMenu from '#app/components/ResumeDownloadMenu.svelte';
    import ResumeEntryList from '#app/components/ResumeEntryList.svelte';
    import { homeProjects } from '#app/projectLists.ts';

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
    const shownProjects = $derived(homeProjects(projects, pinnedRepoNames, HOME_PROJECT_COUNT));
    const hasResumeEntries = $derived(data.experience.length > 0 || data.education.length > 0);
    const siteHost = $derived(page.url.host);
    const showSubscribe = $derived(
        newsletterSignupVisible({
            configured: Boolean(data.newsletterEnabled),
            hasAuthor: Boolean(author),
            hasPublishedPosts: Boolean(data.hasPublishedPosts)
        })
    );

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
    {#if author}
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
            property="og:locale"
            content="en_US" />
        <meta
            property="profile:username"
            content={username} />
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
    {:else}
        <title>{siteHost}</title>
        <meta
            name="robots"
            content="noindex" />
    {/if}
</svelte:head>
<AuthorOgImage
    {author}
    alt="{name} · {desc}" />

{#snippet projectTag(tag: string)}
    <Tag
        variant="accent"
        href="/projects?tag={encodeURIComponent(tag)}"
        aria-label="Show projects tagged {decodeHtmlEntities(tag)}"
        class="font-mono hover:bg-accent/15">{decodeHtmlEntities(tag)}</Tag>
{/snippet}

<PageMain variant="site">
    <Section
        spacing="none"
        class={cn(
            'relative z-10 pt-6 pb-6 sm:pt-8 md:pb-8',
            !author && 'flex flex-1 flex-col justify-center'
        )}>
        <PageContainer
            width="standard"
            class="flex flex-col gap-4 sm:gap-5">
            {#if !author}
                <EmptyState
                    icon={Sprout}
                    title="This site is being set up"
                    description="Check back soon." />
            {:else}
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
                            {#if data.resumeDocument}
                                <ResumeDownloadMenu
                                    document={data.resumeDocument}
                                    shortcutGroup="save"
                                    shortcutChordKey={argKey('/save', 'resume')}
                                    class="w-full" />
                            {/if}

                            {#if projects.length > 0}
                                <Button
                                    type="secondary"
                                    size="md"
                                    href="/projects"
                                    keyboardShortcut={buttonKey('browseProjects')}
                                    shortcutLabel="Browse projects"
                                    class="w-full justify-center">
                                    Browse projects
                                </Button>
                            {/if}

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
                    <ResumeEntryList
                        kind="experience"
                        entries={data.experience} />
                </div>

                <div>
                    <h2 class="mb-4 type-section-title">Education</h2>
                    <ResumeEntryList
                        kind="education"
                        entries={data.education} />
                    {#if hasResumeEntries}
                        <div class="mt-4 flex justify-end">
                            <Button
                                type="ghost"
                                size="sm"
                                href="/resume"
                                keyboardShortcut={buttonKey('viewFullResume')}
                                shortcutLabel="View full resume"
                                aria-label="View full resume including education and experience">
                                <span class="leading-none">View full resume</span>
                                {#snippet trailing()}
                                    <ChevronRight class="size-3" />
                                {/snippet}
                            </Button>
                        </div>
                    {/if}
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
                                <ContentCard {...postCard(post, { banner: true })}>
                                    {#snippet meta()}
                                        <ArticleMeta {...postCardMeta(post)} />
                                    {/snippet}
                                </ContentCard>
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
                    {#if showSubscribe}
                        <SubscribeForm class="mt-4" />
                    {/if}
                </div>

                <div>
                    <h2 class="mb-3 type-section-title sm:mb-4">Recent Projects</h2>
                    {#if shownProjects.length === 0}
                        <EmptyState
                            icon={FolderOpen}
                            title="No projects yet"
                            description="Check back soon for featured repositories." />
                    {:else}
                        <div class="mt-2 grid auto-rows-fr grid-cols-1 gap-3 sm:gap-4">
                            {#each shownProjects as project (project.name)}
                                {#snippet languageTag()}
                                    <ProjectLanguageTag
                                        {project}
                                        languageHref="/projects?language={encodeURIComponent(
                                            project.lang ?? ''
                                        )}" />
                                {/snippet}
                                <ContentCard
                                    {...projectCard(project, pinnedRepoNames)}
                                    tagItem={projectTag}
                                    leadingTag={project.lang ? languageTag : undefined}>
                                    {#snippet meta()}
                                        <ProjectMeta {project} />
                                    {/snippet}
                                </ContentCard>
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
            {/if}
        </PageContainer>
    </Section>

    <FooterSection />
</PageMain>

<QrCodeDialog
    bind:isOpen={isQrOpen}
    url={siteUrl}
    slug={username || 'profile'}
    avatarUrl={avatarWebp}
    onClose={() => (isQrOpen = false)} />
