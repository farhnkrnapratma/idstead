<script lang="ts">
    import Tag from '@fkp/ui/components/Tag.svelte';
    import { FieldValidation, requiredText, emailError } from '@fkp/domain/fieldValidation.ts';
    import {
        avatarSources,
        avatarWebpSource,
        publicAvatarUrl,
        publicBannerOgUrl,
        siteBannerSource,
        siteBannerSources
    } from '#lib/siteIdentity.ts';
    import { onDestroy, onMount, untrack } from 'svelte';
    import type { Snippet } from 'svelte';
    import {
        CircleDollarSign,
        FolderArchive,
        Dot,
        ChevronRight,
        HeartHandshake,
        Rss,
        Star,
        GitFork,
        RotateCcwClock,
        Scale,
        SquareArrowOutUpRight,
        Pin,
        Sparkles,
        AtSign,
        Quote,
        FolderOpen,
        FileUser,
        Layers
    } from '@lucide/svelte';
    import { isNameReserved, extractAuthorNameTokens } from '@fkp/domain/nameValidator.ts';
    import {
        LinkGridSection,
        SpotlightSearch,
        BottomNav,
        CvEntryCard,
        FooterSection,
        SkillGroup,
        SubscribeForm,
        ConsentNotice,
        BlogPostCard,
        ProfileCard,
        QrCodeDialog,
        CvDownloadMenu
    } from '#lib/index.ts';
    import {
        Card,
        ShinyText,
        SkipLink,
        ImageWithSkeleton,
        FormField,
        Input,
        Textarea,
        Button,
        EmptyState,
        Tooltip,
        FilterToolbar,
        FilterChipGroup,
        Dropdown,
        SortControl,
        SearchResultCount,
        FilterEmptyState,
        Pagination,
        toastStore,
        createFilterSortStore,
        PageMain,
        ThemeSelect,
        PageContainer,
        staggerChildren,
        withViewTransition
    } from '@fkp/ui';
    import { decodeHtmlEntities } from '@fkp/mdrs';
    import { Section } from '@fkp/ui';
    import { buttonKey, argKey, sectionCommandKey } from '@fkp/ui/shortcuts.ts';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { page } from '$app/state';
    import { SvelteSet } from 'svelte/reactivity';
    import {
        formatPeriod,
        normalizeSkillGroups,
        type SkillGroup as SkillGroupData
    } from '#lib/profilePageHelpers.ts';
    import { themeStore } from '@fkp/ui/stores/themeStore.svelte.ts';
    import { pluralize } from '@fkp/domain/pluralize.ts';
    import AccessibilitySelect from '@fkp/ui/components/filter/AccessibilitySelect.svelte';
    import {
        turnstileWidget,
        executeTurnstile,
        resetTurnstile,
        turnstileSiteKey
    } from '#lib/utils/turnstile.ts';
    import type { Project } from '@fkp/domain/types.ts';

    let { data } = $props();

    type Section = 'home' | 'blog' | 'contact' | 'cv' | 'projects' | 'funding';

    interface NavItem {
        id: Section;
        label: string;
    }

    let author = $derived(data.author);
    let authorTokens = $derived(extractAuthorNameTokens(author));
    let cvData = $derived(data.cv || { experience: [], education: [] });
    let fundingData = $derived(data.funding || []);
    let contactData = $derived(data.contact || []);

    let name = $derived(author?.name || '');
    let pronunciation = $derived(author?.pronunciation || '');
    let username = $derived(author?.username || '');
    let desc = $derived(author?.bio || '');
    let headline = $derived(author?.headline || '');
    let jobTitle = $derived(author?.jobTitle || '');
    let siteUrl = $derived(author?.siteUrl || '');
    let ogBanner = $derived(publicBannerOgUrl(author));
    let ogImage = $derived(ogBanner || publicAvatarUrl(author));
    let ogImageType = $derived(ogBanner ? 'image/webp' : 'image/png');
    let ogImageWidth = $derived(ogBanner ? '1200' : '512');
    let ogImageHeight = $derived(ogBanner ? '630' : '512');
    let avatar = $derived(author?.avatar || '');
    let avatarWebp = $derived(avatarWebpSource(author) || avatar);
    let avatarFormats = $derived(avatarSources(author));
    let socials = $derived(author?.socialLinks || []);
    let location = $derived([author?.city, author?.country].filter(Boolean).join(', '));
    let isQrOpen = $state(false);
    const navItems: NavItem[] = [
        { id: 'home', label: 'Home' },
        { id: 'projects', label: 'Projects' },
        { id: 'blog', label: 'Blog' },
        { id: 'cv', label: 'CV' },
        { id: 'funding', label: 'Funding' },
        { id: 'contact', label: 'Contact' }
    ];

    const posts = $derived(data.posts || []);

    const failedRepoBanners = new SvelteSet<string>();

    function markRepoBannerFailed(projectName: string) {
        failedRepoBanners.add(projectName);
    }

    let experiences = $derived(cvData.experience || []);
    let education = $derived(cvData.education || []);

    let rawSkills = $derived(data.skills || author?.skills || []);
    let skills = $derived<SkillGroupData[]>(normalizeSkillGroups(rawSkills));

    const skillsSnapshot = $derived(skills.slice(0, 5));

    function skillGroupBasis(skillCount: number): number {
        return 160 + skillCount * 24;
    }

    let contactItems = $derived(
        contactData.map(c => ({
            label: c.platform || c.displayValue,
            value: c.displayValue,
            href: c.href,
            icon: c.icon || '',
            description: c.description || ''
        }))
    );

    interface FundingPlatform {
        label: string;
        value: string;
        shortValue?: string;
        href: string;
        icon: string;
        color?: string;
        description?: string;
    }

    let fundingPlatforms = $derived<FundingPlatform[]>(
        fundingData.map(f => ({
            label: f.platform,
            value: f.displayValue || f.platform,
            href: f.url,
            icon: f.icon || '',
            description: f.description || ''
        }))
    );

    const projects = $derived(data.projects || []);
    const pinnedRepoNames = $derived(
        (data.pinnedRepoNames || []).map((n: string) => n.toLowerCase())
    );
    const NEW_ITEM_WINDOW_MS = 24 * 60 * 60 * 1000;

    function isRepoPinned(project: Project) {
        return pinnedRepoNames.includes(project.name.toLowerCase());
    }

    function isRepoNew(project: Project) {
        if (!project.createdAt) return false;
        return Date.now() - new Date(project.createdAt).getTime() < NEW_ITEM_WINDOW_MS;
    }

    const recentProjects = $derived(
        [...projects]
            .sort(
                (a, b) => new Date(b.pushedAt || 0).getTime() - new Date(a.pushedAt || 0).getTime()
            )
            .slice(0, 2)
    );

    const recentPosts = $derived(posts.slice(0, 2));

    const SECTIONS: Section[] = ['home', 'blog', 'contact', 'cv', 'projects', 'funding'];

    const activeSection = $derived.by<Section>(() => {
        const hash = page.url.hash.replace(/^#/, '').toLowerCase() as Section;
        return SECTIONS.includes(hash) ? hash : 'home';
    });

    let previousSection = $state(untrack(() => activeSection));
    $effect(() => {
        const current = activeSection;
        if (previousSection !== current) {
            previousSection = current;
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    });

    let formName = $state('');
    let formEmail = $state('');
    let formMessage = $state('');
    let formErrors = $state({ name: '', email: '', message: '' });
    let formValid = $state({ name: false, email: false, message: false });
    let isSubmittingMessage = $state(false);
    let turnstileContactEl = $state<HTMLDivElement | null>(null);

    const canClearContactForm = $derived(
        Boolean(formName.trim() || formEmail.trim() || formMessage.trim())
    );

    function clearContactForm() {
        formName = '';
        formEmail = '';
        formMessage = '';
        formErrors = { name: '', email: '', message: '' };
        formValid = { name: false, email: false, message: false };
        validation.reset();
    }

    let contactEmail = $derived.by(() => {
        const emailItem = contactData.find(
            c => c.platform.toLowerCase() === 'email' || c.href.startsWith('mailto:')
        );
        if (emailItem) {
            return (emailItem.displayValue || emailItem.href.replace(/^mailto:/i, '')).trim();
        }
        return author?.email?.trim() || '';
    });

    const validation = new FieldValidation();
    onDestroy(() => validation.destroy());
    validation.register('name', {
        value: () => formName,
        baseline: () => '',
        validate: value =>
            requiredText('Name')(value)
            || (isNameReserved(value, authorTokens) ?
                'This name cannot be used. Please use another name.'
            :   ''),
        report: result => {
            formErrors.name = result.error;
            formValid.name = result.valid;
        }
    });
    validation.register('email', {
        value: () => formEmail,
        baseline: () => '',
        validate: emailError,
        report: result => {
            formErrors.email = result.error;
            formValid.email = result.valid;
        }
    });
    validation.register('message', {
        value: () => formMessage,
        baseline: () => '',
        validate: requiredText('Message'),
        report: result => {
            formErrors.message = result.error;
            formValid.message = result.valid;
        }
    });

    async function validateForm(e: SubmitEvent) {
        e.preventDefault();

        if (!(await validation.submit(undefined, true))) return;

        if (!contactEmail) {
            toastStore.error('Message submission is currently unavailable.');
            return;
        }

        isSubmittingMessage = true;

        try {
            let turnstileToken = '';
            if (turnstileSiteKey) {
                const token = await executeTurnstile(turnstileContactEl);
                if (!token) {
                    toastStore.error('Please complete the security verification.');
                    return;
                }
                turnstileToken = token;
            }

            const res = await fetch('/api/internal/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    kind: 'message',
                    name: formName.trim(),
                    email: formEmail.trim(),
                    message: formMessage.trim(),
                    turnstileToken
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || data?.success !== true) {
                throw new Error(
                    typeof data?.error?.message === 'string' ?
                        data.error.message
                    :   'Failed to send message.'
                );
            }

            toastStore.success('Message sent successfully. Thank you!');
            formName = '';
            formEmail = '';
            formMessage = '';
            formErrors = { name: '', email: '', message: '' };
            formValid = { name: false, email: false, message: false };
            validation.reset();
        } catch (err) {
            const msg =
                err instanceof Error && err.message ?
                    err.message
                :   'Failed to send message. Please try again later.';
            toastStore.error(msg);
        } finally {
            isSubmittingMessage = false;
            resetTurnstile(turnstileContactEl);
        }
    }

    function navigate(section: Section) {
        if (section === activeSection) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        withViewTransition(
            () =>
                goto(section === 'home' ? resolve('/') : `${resolve('/')}#${section}`, {
                    reset: false
                }),
            'context'
        );
    }

    const projectFilterStore = createFilterSortStore({
        defaultSortField: 'date',
        defaultSortDir: 'desc'
    });

    const allProjectTags = $derived.by(() => {
        const set = new SvelteSet<string>();
        for (const p of projects) {
            if (p.tags) {
                p.tags.forEach(t => set.add(t));
            }
        }
        return Array.from(set);
    });

    const filteredProjectList = $derived.by(() => {
        let list = projects;

        const q = projectFilterStore.search.trim().toLowerCase();
        if (q) {
            list = list.filter(
                p =>
                    p.name.toLowerCase().includes(q)
                    || p.desc.toLowerCase().includes(q)
                    || (p.lang && p.lang.toLowerCase().includes(q))
            );
        }

        const selectedTags = projectFilterStore.filters['tag'] || [];
        if (selectedTags.length > 0) {
            list = list.filter(p => p.tags && p.tags.some(t => selectedTags.includes(t)));
        }

        const sortField = projectFilterStore.sort.field;
        const sortDir = projectFilterStore.sort.direction === 'asc' ? 1 : -1;

        return [...list].sort((a, b) => {
            if (isRepoPinned(a) !== isRepoPinned(b)) {
                return isRepoPinned(a) ? -1 : 1;
            }

            if (sortField === 'name') {
                return a.name.localeCompare(b.name) * sortDir;
            } else if (sortField === 'stars') {
                return ((a.stars || 0) - (b.stars || 0)) * sortDir;
            } else if (sortField === 'license') {
                const lA = a.licenseName || '';
                const lB = b.licenseName || '';
                return lA.localeCompare(lB) * sortDir;
            } else {
                return a.name.localeCompare(b.name) * sortDir;
            }
        });
    });

    const PAGE_SIZE = 5;

    let projectPage = $state(1);

    const projectTotalPages = $derived(
        Math.max(1, Math.ceil(filteredProjectList.length / PAGE_SIZE))
    );
    const projectPageClamped = $derived(Math.min(projectPage, projectTotalPages));
    const paginatedProjectList = $derived(
        filteredProjectList.slice(
            (projectPageClamped - 1) * PAGE_SIZE,
            projectPageClamped * PAGE_SIZE
        )
    );

    $effect(() => {
        void projectFilterStore.search;
        void projectFilterStore.filters;
        void projectFilterStore.sort;
        untrack(() => {
            projectPage = 1;
        });
    });

    onMount(() => {
        projectFilterStore.parseFromUrl(new URL(window.location.href));
    });

    let jsonLdScript = $derived(
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
    <script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        async
        defer></script>
</svelte:head>

<SkipLink />

<nav
    class="fixed inset-x-2 top-2 z-40 flex h-12 items-center justify-between rounded-md glass-card border border-border-subtle/30 px-3 font-sans shadow-2xs sm:inset-x-3 sm:top-3 sm:h-14 sm:px-5"
    aria-label="Main navigation">
    <div class="flex shrink-0 items-center lg:w-1/4 lg:flex-none">
        <Button
            type="ghost"
            size="sm"
            htmlType="button"
            onclick={() => navigate('home')}
            aria-label={name}
            class="flex h-9 items-center gap-2 rounded-md border-0 px-1.5 sm:px-2">
            {#snippet leading()}
                {#if avatar}
                    <ImageWithSkeleton
                        src={avatarWebp}
                        sources={avatarFormats}
                        alt={`Profile picture of ${name}`}
                        variant="avatar"
                        rounded="rounded-full"
                        class="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
                {/if}
            {/snippet}
            <span
                class="truncate text-sm font-semibold text-text-primary {avatar ? 'hidden lg:inline'
                :   'inline'}">
                {name}
            </span>
        </Button>
    </div>

    <nav
        class="hidden md:flex md:flex-1 md:items-center md:justify-center"
        aria-label="Section navigation">
        <ul class="flex items-center gap-1">
            {#each navItems as item (item.id)}
                <li>
                    <Button
                        type={activeSection === item.id ? 'primary' : 'ghost'}
                        size="sm"
                        htmlType="button"
                        aria-current={activeSection === item.id ? 'location' : undefined}
                        onclick={() => navigate(item.id)}
                        keyboardShortcut={sectionCommandKey(item.id)}
                        shortcutLabel={item.label}
                        class="h-9 px-3 text-sm {activeSection === item.id ?
                            ''
                        :   'font-medium hover:bg-surface-hover'}">
                        {item.label}
                    </Button>
                </li>
            {/each}
        </ul>
    </nav>

    <div class="flex shrink-0 items-center justify-end gap-1 sm:gap-2 lg:w-1/4 lg:flex-none">
        <SpotlightSearch
            projects={data.projects}
            variant="responsive" />
        <ThemeSelect
            theme={themeStore.current}
            onThemeChange={themeStore.apply} />
        <AccessibilitySelect />
    </div>
</nav>

{#snippet staticTag(tag: string)}
    <Tag
        variant="accent"
        class="font-mono">{decodeHtmlEntities(tag)}</Tag>
{/snippet}

{#snippet filterableTag(tag: string)}
    {@const isSelected = projectFilterStore.filters['tag']?.includes(tag) ?? false}
    <Tag
        variant={isSelected ? 'accent-active' : 'accent'}
        onclick={() => projectFilterStore.toggleMultiFilter('tag', tag)}
        aria-pressed={isSelected}
        class={isSelected ? 'font-mono' : 'font-mono hover:bg-accent/15'}>
        {decodeHtmlEntities(tag)}
    </Tag>
{/snippet}

{#snippet projectCard(project: Project, headingTag: 'h3' | 'h4', tagItem: Snippet<[string]>)}
    {@const repoBannerUrl =
        project.openGraphImageUrl || `https://opengraph.githubassets.com/1/${project.fullName}`}
    <div class="relative flex flex-col rounded-md glass-card border-0! text-left dark:border-0!">
        <div class="relative aspect-2/1 w-full shrink-0 overflow-hidden rounded-t-md">
            {#if !failedRepoBanners.has(project.name)}
                <ImageWithSkeleton
                    src={repoBannerUrl}
                    alt={`Banner image for project “${project.name}”`}
                    rounded=""
                    onerror={() => markRepoBannerFailed(project.name)}
                    class="h-full w-full object-cover" />
            {:else}
                <div
                    class="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 to-accent/5 select-none">
                    <FolderArchive class="size-10 text-accent/50" />
                </div>
            {/if}
        </div>

        <div
            class="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3 font-sans sm:gap-2.5 sm:p-4">
            <div class="flex flex-col gap-1.5 sm:gap-2">
                <div>
                    <svelte:element
                        this={headingTag}
                        class="type-card-title">
                        {project.name}
                        {#if isRepoPinned(project) || isRepoNew(project)}
                            <span class="inline-flex items-center gap-1 align-middle select-none">
                                {#if isRepoPinned(project)}
                                    <span
                                        class="inline-flex size-4.5 items-center justify-center rounded-full bg-success-subtle text-success"
                                        title="Pinned repository"
                                        role="img"
                                        aria-label="Pinned repository">
                                        <Pin class="size-3 shrink-0" />
                                    </span>
                                {/if}
                                {#if isRepoNew(project)}
                                    <span
                                        class="inline-flex size-4.5 items-center justify-center rounded-full bg-security-subtle text-accent-text"
                                        title="New repository"
                                        role="img"
                                        aria-label="New repository">
                                        <Sparkles class="size-3 shrink-0" />
                                    </span>
                                {/if}
                            </span>
                        {/if}
                    </svelte:element>
                </div>

                <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs">
                    {#if project.lang}
                        <span
                            class="inline-flex items-center text-xs leading-none font-medium text-text-secondary select-none">
                            <Dot
                                strokeWidth={10}
                                class="size-3.5 shrink-0"
                                color={project.langColor ?? '#909692'} />
                            <span class="leading-none">{project.lang}</span>
                        </span>
                    {/if}
                    <span
                        class="inline-flex items-center gap-1.5 leading-none font-normal whitespace-nowrap text-text-secondary">
                        <Star
                            class="size-3.5 shrink-0 text-text-muted/70 transition-colors"
                            strokeWidth={1.75}
                            absoluteStrokeWidth={true} />
                        <span>{pluralize(project.stars, 'star')}</span>
                    </span>
                    <span
                        class="hidden items-center gap-1.5 leading-none font-normal whitespace-nowrap text-text-secondary sm:inline-flex">
                        <GitFork
                            class="size-3.5 shrink-0 text-text-muted/70 transition-colors"
                            strokeWidth={1.75}
                            absoluteStrokeWidth={true} />
                        <span>{pluralize(project.forks, 'fork')}</span>
                    </span>
                    <span
                        class="hidden items-center gap-1.5 leading-none font-normal whitespace-nowrap text-text-secondary sm:inline-flex">
                        <RotateCcwClock
                            class="size-3.5 shrink-0 text-text-muted/70 transition-colors"
                            strokeWidth={1.75}
                            absoluteStrokeWidth={true} />
                        <span>{pluralize(project.commits, 'commit')}</span>
                    </span>
                    {#if project.licenseName}
                        <span
                            class="inline-flex items-center gap-1.5 leading-none font-normal whitespace-nowrap text-text-secondary">
                            <Scale
                                class="size-3.5 shrink-0 text-text-muted/70 transition-colors"
                                strokeWidth={1.75}
                                absoluteStrokeWidth={true} />
                            <span>{project.licenseName} License</span>
                        </span>
                    {/if}
                </div>

                {#if project.desc}
                    <p class="type-body text-text-secondary">{project.desc}</p>
                {/if}

                {#if project.tags && project.tags.length > 0}
                    <div class="relative z-20 flex flex-wrap items-center gap-1.5 pt-0.5">
                        {#each project.tags as tag (tag)}
                            {@render tagItem(tag)}
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="relative z-20 mt-auto flex flex-col gap-2 pt-1">
                <hr class="border-border-subtle/25" />
                <Button
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    type="primary"
                    size="sm"
                    shortcutGroup="projects"
                    shortcutLabel={project.name}
                    fullWidth>
                    {#snippet leading()}
                        <SquareArrowOutUpRight class="size-3.5" />
                    {/snippet}
                    View on GitHub
                </Button>
            </div>
        </div>
    </div>
{/snippet}

<PageMain class="pb-16 md:pb-0">
    {#if activeSection === 'home'}
        <Section
            spacing="none"
            class="relative z-10 pt-4 pb-6 sm:pt-5 md:pt-10 md:pb-8">
            <PageContainer
                width="standard"
                class="flex flex-col gap-4 sm:gap-5">
                <ProfileCard
                    {name}
                    {pronunciation}
                    {headline}
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
                                onclick={() => navigate('projects')}
                                keyboardShortcut={buttonKey('browseProjects')}
                                shortcutLabel="Browse projects"
                                class="w-full justify-center">
                                Browse projects
                            </Button>

                            <Button
                                type="ghost"
                                size="md"
                                onclick={() => navigate('contact')}
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
                    <h2 class="mb-3 type-section-title sm:mb-4">Recent Posts</h2>
                    {#if posts.length === 0}
                        <EmptyState
                            icon={Quote}
                            title="No posts yet"
                            description="Check back soon for new articles." />
                    {:else}
                        <div class="mt-2 grid auto-rows-fr grid-cols-1 gap-3 sm:gap-4">
                            {#each recentPosts as post (post.id)}
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
                    <h2 class="mb-3 type-section-title sm:mb-4">Top Projects</h2>
                    {#if recentProjects.length === 0}
                        <EmptyState
                            icon={FolderOpen}
                            title="No projects yet"
                            description="Check back soon for featured repositories." />
                    {:else}
                        <div class="mt-2 grid auto-rows-fr grid-cols-1 gap-3 sm:gap-4">
                            {#each recentProjects as project (project.name)}
                                {@render projectCard(project, 'h3', staticTag)}
                            {/each}
                        </div>
                    {/if}
                    {#if projects.length > 0}
                        <div class="mt-3 flex justify-end sm:mt-4">
                            <Button
                                type="ghost"
                                size="sm"
                                htmlType="button"
                                onclick={() => navigate('projects')}
                                keyboardShortcut={buttonKey('viewAllProjects')}
                                shortcutLabel="View all projects">
                                View all projects
                                {#snippet trailing()}<ChevronRight class="size-3" />{/snippet}
                            </Button>
                        </div>
                    {/if}
                </div>

                <div>
                    <h2 class="mb-4 type-section-title">Skills</h2>
                    {#if skillsSnapshot.length === 0}
                        <EmptyState
                            icon={Layers}
                            title="No skills listed yet"
                            description="Check back soon for updated skills." />
                    {:else}
                        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            {#each skillsSnapshot as group (group.category)}
                                <div
                                    class="sm:min-w-0 sm:shrink sm:grow sm:basis-(--sg-basis)"
                                    style="--sg-basis: {skillGroupBasis(group.items.length)}px">
                                    <SkillGroup
                                        category={group.category}
                                        skills={group.items}
                                        class="h-full" />
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <div>
                    <h2 class="mb-4 type-section-title">Experience</h2>
                    {#if experiences.length === 0}
                        <EmptyState
                            icon={FileUser}
                            title="No experience listed yet"
                            description="Check back soon for career history." />
                    {:else}
                        <div
                            class="divide-y divide-border-subtle/40 overflow-hidden rounded-md glass-card text-left">
                            {#each experiences as exp (exp.company + exp.location + exp.startYear)}
                                <CvEntryCard
                                    role={exp.title}
                                    organization={exp.company}
                                    location={exp.location}
                                    period={formatPeriod(
                                        exp.startMonth,
                                        exp.startYear,
                                        exp.endMonth,
                                        exp.endYear,
                                        exp.currentlyIn
                                    )}
                                    description={exp.description} />
                            {/each}
                        </div>
                    {/if}
                    <div class="mt-4 flex justify-end">
                        <Button
                            type="ghost"
                            size="sm"
                            htmlType="button"
                            onclick={() => navigate('cv')}
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

                <Card
                    density="none"
                    class="text-left">
                    <div
                        class="flex flex-col justify-between gap-4 gap-x-4 gap-y-1 p-3 sm:flex-row sm:items-center sm:p-4">
                        <div
                            class="relative size-20 shrink-0 items-center justify-center sm:flex"
                            aria-hidden="true">
                            <div
                                class="absolute inset-0 border-border-subtle/80 bg-surface-elevated/40 sm:rounded-full sm:border sm:border-dashed">
                            </div>
                            <HeartHandshake
                                class="absolute top-4 left-4 size-9 fill-accent/15 text-accent-text"
                                strokeWidth={1.5} />
                            <CircleDollarSign
                                class="absolute right-3 bottom-3 size-8 rounded-full bg-surface-card p-1 text-gh-orange-1"
                                strokeWidth={1.75} />
                        </div>
                        <div>
                            <h4 class="type-card-title text-balance">
                                <ShinyText
                                    text="Support My Open Source Work"
                                    color="var(--color-accent)"
                                    shineColor="var(--color-text-on-accent)"
                                    speed={3} />
                            </h4>
                            <p class="col-span-2 type-body text-pretty text-text-secondary">
                                Your support helps keep my open source projects maintained and
                                sustainable over time.
                            </p>
                        </div>
                    </div>
                    <div
                        class="flex justify-center border-t border-border-subtle/60 px-3.5 py-3 sm:px-4">
                        <Button
                            type="primary"
                            size="sm"
                            class="w-full"
                            onclick={() => navigate('funding')}
                            keyboardShortcut={buttonKey('becomeSponsor')}
                            shortcutLabel="Become a sponsor">
                            Become a sponsor
                            {#snippet trailing()}
                                <ChevronRight
                                    class="size-3"
                                    aria-hidden="true" />
                            {/snippet}
                        </Button>
                    </div>
                </Card>

                <form
                    novalidate
                    onsubmit={validateForm}
                    class="flex w-full flex-col gap-2.5 rounded-md glass-card p-4 text-left sm:gap-3 sm:p-6"
                    autocomplete="off">
                    <div class="mb-2 select-none">
                        <h2 class="type-card-title">Send a Message</h2>
                        <p class="mt-0.5 type-body text-text-muted">
                            Feel free to drop me a line. I'll get back to you as soon as possible.
                        </p>
                    </div>

                    <FormField
                        id="form-name"
                        label="Name"
                        variant="floating"
                        required
                        hideAsterisk
                        maxlength={50}
                        currentLength={formName.length}
                        error={formErrors.name}
                        valid={formValid.name}>
                        <Input
                            type="text"
                            id="form-name"
                            name="name"
                            autocomplete="name"
                            maxlength={50}
                            bind:value={formName}
                            error={!!formErrors.name}
                            valid={formValid.name}
                            oninput={() => {
                                formErrors.name = '';
                                formValid.name = false;
                                queueMicrotask(() => validation.input('name'));
                            }}
                            onblur={() => {
                                void validation.check('name');
                            }} />
                    </FormField>

                    <FormField
                        id="form-email"
                        label="Email"
                        variant="floating"
                        required
                        hideAsterisk
                        maxlength={100}
                        currentLength={formEmail.length}
                        error={formErrors.email}
                        valid={formValid.email}>
                        <Input
                            type="text"
                            id="form-email"
                            name="email"
                            autocomplete="email"
                            maxlength={100}
                            bind:value={formEmail}
                            error={!!formErrors.email}
                            valid={formValid.email}
                            oninput={() => {
                                formErrors.email = '';
                                formValid.email = false;
                                queueMicrotask(() => validation.input('email'));
                            }}
                            onblur={() => {
                                void validation.check('email');
                            }} />
                    </FormField>

                    <FormField
                        id="form-message"
                        label="Message"
                        variant="floating"
                        required
                        hideAsterisk
                        maxlength={2000}
                        currentLength={formMessage.length}
                        counter={`${formMessage.length}/2000`}
                        error={formErrors.message}
                        valid={formValid.message}>
                        <Textarea
                            id="form-message"
                            name="message"
                            rows={4}
                            maxlength={2000}
                            bind:value={formMessage}
                            error={!!formErrors.message}
                            valid={formValid.message}
                            oninput={() => {
                                formErrors.message = '';
                                formValid.message = false;
                                queueMicrotask(() => validation.input('message'));
                            }}
                            onblur={() => {
                                void validation.check('message');
                            }} />
                    </FormField>

                    <div
                        bind:this={turnstileContactEl}
                        class="turnstile-widget select-none"
                        use:turnstileWidget={{
                            sitekey: turnstileSiteKey,
                            size: 'flexible',
                            action: 'contact-message',
                            theme: 'auto',
                            appearance: 'interaction-only',
                            execution: 'execute'
                        }}>
                    </div>

                    <ConsentNotice action="sending this message" />

                    <div class="mt-2 flex items-center justify-between gap-2 select-none">
                        <Button
                            htmlType="button"
                            type="outline"
                            tone="critical"
                            size="md"
                            class="flex-1 sm:flex-initial"
                            disabled={!canClearContactForm || isSubmittingMessage}
                            keyboardShortcut={buttonKey('formClear')}
                            shortcutLabel="Clear message"
                            onclick={clearContactForm}>
                            <span>Clear<span class="hidden sm:inline">&nbsp;message</span></span>
                        </Button>
                        <Button
                            htmlType="submit"
                            type="primary"
                            size="md"
                            class="flex-1 sm:flex-initial"
                            aria-keyshortcuts="Control+Enter Meta+Enter"
                            disabled={isSubmittingMessage}
                            isLoading={isSubmittingMessage}
                            keyboardShortcut={buttonKey('formSubmit')}
                            shortcutLabel="Send message">
                            {isSubmittingMessage ? 'Sending…' : 'Send message'}
                        </Button>
                    </div>
                </form>
            </PageContainer>
        </Section>
    {/if}

    {#if activeSection === 'contact'}
        <LinkGridSection
            title="Contact"
            subtitle="Reach out through any of the channels below."
            items={contactItems}
            shortcutGroup="contact"
            emptyIcon={AtSign}
            emptyTitle="No contact channels yet"
            emptyDescription="Check back soon for ways to get in touch." />
    {/if}

    {#if activeSection === 'cv'}
        <Section
            spacing="none"
            class="relative z-10 pt-5 pb-6 md:pt-8 md:pb-8">
            <PageContainer width="standard">
                <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 class="type-page-title">Curriculum Vitae</h1>
                        <p class="mt-2 text-sm text-text-secondary">View or download my resume.</p>
                    </div>
                    <div class="flex flex-col items-start gap-1.5 sm:items-end">
                        <CvDownloadMenu
                            document={data.cvDocument}
                            placement="bottom-end"
                            shortcutGroup="save"
                            shortcutChordKey={argKey('/save', 'cv')} />
                    </div>
                </div>

                <div class="mt-8">
                    <h2 class="mb-4 type-section-title">Experience</h2>
                    {#if experiences.length === 0}
                        <div class="mt-4">
                            <EmptyState
                                icon={FileUser}
                                title="No experience listed yet"
                                description="Check back soon for career history." />
                        </div>
                    {:else}
                        <div
                            class="divide-y divide-border-subtle/40 overflow-hidden rounded-md glass-card">
                            {#each experiences as exp (exp.company + exp.location + exp.startYear)}
                                <CvEntryCard
                                    role={exp.title}
                                    organization={exp.company}
                                    location={exp.location}
                                    period={formatPeriod(
                                        exp.startMonth,
                                        exp.startYear,
                                        exp.endMonth,
                                        exp.endYear,
                                        exp.currentlyIn
                                    )}
                                    description={exp.description} />
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="mt-8">
                    <h2 class="mb-4 type-section-title">Education</h2>
                    {#if education.length === 0}
                        <div class="mt-4">
                            <EmptyState
                                icon={FileUser}
                                title="No education listed yet"
                                description="Check back soon for academic history." />
                        </div>
                    {:else}
                        <div
                            class="divide-y divide-border-subtle/40 overflow-hidden rounded-md glass-card">
                            {#each education as edu (edu.institution + edu.startYear)}
                                <CvEntryCard
                                    role={edu.degree}
                                    organization={edu.institution}
                                    period={formatPeriod(
                                        edu.startMonth,
                                        edu.startYear,
                                        edu.endMonth,
                                        edu.endYear,
                                        edu.currentlyIn
                                    )}
                                    description={edu.description} />
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="mt-8">
                    <h2 class="mb-4 type-section-title">Skills</h2>
                    {#if skills.length === 0}
                        <div class="mt-4">
                            <EmptyState
                                icon={Layers}
                                title="No skills listed yet"
                                description="Check back soon for updated skills." />
                        </div>
                    {:else}
                        <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            {#each skills as group (group.category)}
                                <div
                                    class="sm:min-w-0 sm:shrink sm:grow sm:basis-(--sg-basis)"
                                    style="--sg-basis: {skillGroupBasis(group.items.length)}px">
                                    <SkillGroup
                                        category={group.category}
                                        skills={group.items}
                                        class="h-full" />
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            </PageContainer>
        </Section>
    {/if}

    {#if activeSection === 'blog'}
        <Section
            spacing="none"
            class="relative z-10 pt-5 pb-6 md:pt-8 md:pb-8">
            <PageContainer width="standard">
                <div class="mb-6 flex items-end justify-between gap-4">
                    <div>
                        <h1 class="type-page-title">Blog</h1>
                        <p class="mt-2 text-sm text-text-secondary">
                            Articles on the things I'm building, learning, and thinking about.
                        </p>
                    </div>
                    <Tooltip
                        content="RSS Feed"
                        placement="bottom"
                        align="right"
                        class="sm:hidden">
                        <Button
                            type="ghost"
                            size="md"
                            href="/atom.xml"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Subscribe via Atom/RSS feed"
                            keyboardShortcut={buttonKey('feed')}
                            shortcutLabel="RSS feed"
                            class="mb-0.5 shrink-0 border border-border-subtle bg-surface-card text-text-muted hover:bg-surface-hover hover:text-brand-rss">
                            {#snippet leading()}
                                <Rss class="size-3.5 select-none" />
                            {/snippet}
                            <span class="hidden items-center sm:inline">Feed</span>
                        </Button>
                    </Tooltip>
                </div>

                {#if posts.length === 0}
                    <EmptyState
                        icon={Quote}
                        title="No posts yet"
                        description="Articles will appear here once published." />
                {:else}
                    <div
                        use:staggerChildren
                        class="stagger-children relative z-0 mt-2 grid auto-rows-fr grid-cols-1 gap-4">
                        {#each posts as post (post.id)}
                            <BlogPostCard
                                {post}
                                headingTag="h2" />
                        {/each}
                    </div>
                    <div class="mt-6 flex justify-end">
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
            </PageContainer>
        </Section>
    {/if}

    {#if activeSection === 'projects'}
        <Section
            spacing="none"
            class="relative z-10 pt-5 pb-6 md:pt-8 md:pb-8">
            <PageContainer width="standard">
                <div class="mb-6">
                    <h1 class="type-page-title">Projects</h1>
                    <p class="mt-2 text-sm text-text-secondary">Open source work on GitHub.</p>
                </div>

                {#if projects.length > 0}
                    <div class="mb-6">
                        <FilterToolbar title="Projects filter">
                            {#snippet searchSlot()}
                                <Input
                                    type="search"
                                    placeholder="Search projects..."
                                    value={projectFilterStore.search}
                                    oninput={e =>
                                        projectFilterStore.setSearch(
                                            (e.target as HTMLInputElement).value
                                        )}
                                    keyboardShortcut={buttonKey('filterSearch')}
                                    shortcutLabel="Search projects"
                                    aria-label="Search projects" />
                            {/snippet}

                            {#snippet filterControlsSlot()}
                                {#if allProjectTags.length > 0}
                                    <Dropdown
                                        multiple
                                        searchable
                                        label="Topics"
                                        options={allProjectTags.map(t => ({ value: t, label: t }))}
                                        value={projectFilterStore.filters['tag'] || []}
                                        onChange={val =>
                                            projectFilterStore.toggleMultiFilter('tag', val)} />
                                {/if}
                            {/snippet}

                            {#snippet countSlot()}
                                <SearchResultCount
                                    count={filteredProjectList.length}
                                    total={projects.length}
                                    itemLabel="projects" />
                            {/snippet}

                            {#snippet sortSlot()}
                                <SortControl
                                    fields={[
                                        { value: 'name', label: 'Name' },
                                        { value: 'stars', label: 'Stars' },
                                        { value: 'license', label: 'License' }
                                    ]}
                                    currentField={projectFilterStore.sort.field}
                                    currentDirection={projectFilterStore.sort.direction}
                                    onFieldChange={field => projectFilterStore.setSort(field)}
                                    onDirectionToggle={() =>
                                        projectFilterStore.toggleSortDirection()} />
                            {/snippet}

                            {#snippet chipsSlot()}
                                <FilterChipGroup
                                    chips={projectFilterStore.activeChips}
                                    onRemove={(type, val) =>
                                        projectFilterStore.removeFilter(type, val)}
                                    onClearAll={() => projectFilterStore.clearAllFilters()} />
                            {/snippet}
                        </FilterToolbar>
                    </div>
                {/if}

                {#if projects.length === 0}
                    <EmptyState
                        icon={FolderOpen}
                        title="No projects yet"
                        description="Projects will appear here." />
                {:else if filteredProjectList.length === 0}
                    <FilterEmptyState
                        title="No projects match these filters"
                        description="Try adjusting your tech stack filters or search keyword."
                        onClearFilters={() => projectFilterStore.clearAllFilters()} />
                {:else}
                    <div
                        use:staggerChildren
                        class="stagger-children relative z-0 mt-2 grid auto-rows-fr grid-cols-1 gap-4">
                        {#each paginatedProjectList as project (project.name)}
                            {@render projectCard(project, 'h3', filterableTag)}
                        {/each}
                    </div>
                    <div class="mt-6">
                        <Pagination
                            page={projectPageClamped}
                            totalPages={projectTotalPages}
                            onPageChange={p => (projectPage = p)} />
                    </div>
                {/if}
            </PageContainer>
        </Section>
    {/if}

    {#if activeSection === 'funding'}
        <LinkGridSection
            title="Supporting & Funding"
            subtitle="Ways to support my work."
            items={fundingPlatforms}
            shortcutGroup="funding"
            emptyIcon={HeartHandshake}
            emptyTitle="No funding platforms yet"
            emptyDescription="Check back soon for ways to support this work." />
    {/if}

    <div
        class="mx-auto w-full max-w-full px-3 sm:px-6 md:w-[80%] lg:w-[50%] {(
            activeSection === 'home'
        ) ?
            'my-6'
        :   'mt-2 mb-6'}"
        aria-hidden="true">
        <div class="w-full border-t border-border-subtle/60"></div>
    </div>

    <FooterSection
        onNavClick={url => {
            if (url.startsWith('/#')) {
                navigate(url.replace('/#', '') as Section);
            } else if (url === '/') {
                navigate('home');
            } else {
                window.location.href = url;
            }
        }} />
</PageMain>

<QrCodeDialog
    bind:isOpen={isQrOpen}
    title={name}
    url={siteUrl}
    slug={username || 'profile'}
    avatarUrl={avatarWebp}
    onClose={() => (isQrOpen = false)} />

<BottomNav
    {activeSection}
    onNavigate={navigate} />
