<script lang="ts">
    import { onMount } from 'svelte';
    import { SvelteSet } from 'svelte/reactivity';
    import { page } from '$app/state';
    import { Rss } from '@lucide/svelte';
    import Tag from '#lib/components/Tag.svelte';
    import {
        BlogPostCard,
        Button,
        Dropdown,
        EmptyState,
        FilterChipGroup,
        FilterEmptyState,
        FilterToolbar,
        FooterSection,
        Input,
        PageContainer,
        Pagination,
        SearchResultCount,
        Section,
        SortControl,
        Tooltip,
        TopNav,
        createFilterSortStore,
        decodeHtmlEntities,
        staggerChildren
    } from '#lib/index.ts';
    import { buttonKey } from '#lib/shortcuts.ts';
    import { publicAvatarUrl, publicBannerOgUrl } from '#lib/siteIdentity.ts';

    let { data } = $props();

    const PAGE_SIZE = 10;

    const posts = $derived(data.posts ?? []);
    const pageAuthor = $derived((page?.data as any)?.author);
    const pageProjects = $derived((page?.data as any)?.projects ?? []);
    const authorName = $derived(pageAuthor?.name || '');
    const siteUrl = $derived((pageAuthor?.siteUrl || '').replace(/\/$/, ''));
    const description = $derived(
        `Articles on the things ${authorName || 'I'} ${authorName ? 'is' : 'am'} building, learning, and thinking about.`
    );
    const ogBanner = $derived(publicBannerOgUrl(pageAuthor));
    const ogImage = $derived(ogBanner || publicAvatarUrl(pageAuthor));
    const ogImageType = $derived(ogBanner ? 'image/webp' : 'image/png');
    const ogImageWidth = $derived(ogBanner ? '1200' : '512');
    const ogImageHeight = $derived(ogBanner ? '630' : '512');

    const filters = createFilterSortStore({ defaultSortField: 'date', defaultSortDir: 'desc' });

    const allTags = $derived.by(() => {
        const set = new SvelteSet<string>();
        for (const post of posts) post.tags?.forEach(tag => set.add(decodeHtmlEntities(tag)));
        return Array.from(set);
    });

    const filteredPosts = $derived.by(() => {
        const query = filters.search.trim().toLowerCase();
        const selectedTags = filters.filters['tag'] || [];
        const direction = filters.sort.direction === 'asc' ? 1 : -1;
        return posts
            .filter(
                post =>
                    !query
                    || post.title.toLowerCase().includes(query)
                    || post.excerpt?.toLowerCase().includes(query)
            )
            .filter(post => !selectedTags.length || post.tags?.some(t => selectedTags.includes(t)))
            .sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                switch (filters.sort.field) {
                    case 'title':
                        return a.title.localeCompare(b.title) * direction;
                    case 'readingTime':
                        return (
                            (parseInt(a.read_time || '0', 10) - parseInt(b.read_time || '0', 10))
                            * direction
                        );
                    case 'views':
                        return ((a.views_count ?? 0) - (b.views_count ?? 0)) * direction;
                    case 'comments':
                        return ((a.comment_count ?? 0) - (b.comment_count ?? 0)) * direction;
                    default:
                        return (
                            (new Date(a.created_at || 0).getTime()
                                - new Date(b.created_at || 0).getTime())
                            * direction
                        );
                }
            });
    });

    const filterKey = $derived(JSON.stringify([filters.search, filters.filters, filters.sort]));
    let pageSelection = $state({ key: '', page: 1 });
    const currentPage = $derived(pageSelection.key === filterKey ? pageSelection.page : 1);
    const totalPages = $derived(Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE)));
    const pageClamped = $derived(Math.min(currentPage, totalPages));
    const visiblePosts = $derived(
        filteredPosts.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE)
    );

    onMount(() => {
        filters.parseFromUrl(new URL(window.location.href));
    });
</script>

<svelte:head>
    <title>Blog{authorName ? ` — ${authorName}` : ''}</title>
    <meta
        name="description"
        content={description} />
    <link
        rel="canonical"
        href="{siteUrl}/blog" />
    <link
        rel="alternate"
        type="application/atom+xml"
        title="Atom feed"
        href="/atom.xml" />
    <meta
        property="og:title"
        content="Blog{authorName ? ` — ${authorName}` : ''}" />
    <meta
        property="og:description"
        content={description} />
    <meta
        property="og:type"
        content="website" />
    <meta
        property="og:url"
        content="{siteUrl}/blog" />
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
        name="twitter:image"
        content={ogImage} />
    <meta
        name="twitter:card"
        content="summary_large_image" />
</svelte:head>

{#snippet filterableTag(tag: string)}
    {@const isSelected = filters.filters['tag']?.includes(tag) ?? false}
    <Tag
        variant={isSelected ? 'accent-active' : 'accent'}
        onclick={() => filters.toggleMultiFilter('tag', tag)}
        aria-pressed={isSelected}
        class={isSelected ? 'font-mono' : 'font-mono hover:bg-accent/15'}>
        {decodeHtmlEntities(tag)}
    </Tag>
{/snippet}

<TopNav
    ariaLabel="Blog navigation"
    backHref="/"
    backLabel="Home"
    projects={pageProjects} />

<main
    id="main-content"
    class="flex min-h-[calc(100vh-3rem)] flex-col pt-12 font-sans sm:min-h-[calc(100vh-3.5rem)] sm:pt-14">
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
                    align="right">
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

            {#if posts.length > 0}
                <div class="mb-6">
                    <FilterToolbar title="Blog posts filter">
                        {#snippet searchSlot()}
                            <Input
                                type="search"
                                placeholder="Search articles..."
                                value={filters.search}
                                oninput={e =>
                                    filters.setSearch((e.target as HTMLInputElement).value)}
                                keyboardShortcut={buttonKey('filterSearch')}
                                shortcutLabel="Search articles"
                                aria-label="Search articles" />
                        {/snippet}

                        {#snippet filterControlsSlot()}
                            {#if allTags.length > 0}
                                <Dropdown
                                    multiple
                                    searchable
                                    label="Tags"
                                    options={allTags.map(t => ({ value: t, label: t }))}
                                    value={filters.filters['tag'] || []}
                                    onChange={val => filters.toggleMultiFilter('tag', val)} />
                            {/if}
                        {/snippet}

                        {#snippet countSlot()}
                            <SearchResultCount
                                count={filteredPosts.length}
                                total={posts.length}
                                itemLabel="articles" />
                        {/snippet}

                        {#snippet sortSlot()}
                            <SortControl
                                fields={[
                                    { value: 'date', label: 'Date' },
                                    { value: 'views', label: 'Views' },
                                    { value: 'comments', label: 'Comments' },
                                    { value: 'readingTime', label: 'Reading time' },
                                    { value: 'title', label: 'Title' }
                                ]}
                                currentField={filters.sort.field}
                                currentDirection={filters.sort.direction}
                                onFieldChange={field => filters.setSort(field)}
                                onDirectionToggle={() => filters.toggleSortDirection()} />
                        {/snippet}

                        {#snippet chipsSlot()}
                            <FilterChipGroup
                                chips={filters.activeChips}
                                onRemove={(type, val) => filters.removeFilter(type, val)}
                                onClearAll={() => filters.clearAllFilters()} />
                        {/snippet}
                    </FilterToolbar>
                </div>
            {/if}

            {#if posts.length === 0}
                <EmptyState
                    title="No posts yet"
                    description="Articles will appear here once published." />
            {:else if filteredPosts.length === 0}
                <FilterEmptyState
                    title="No articles match these filters"
                    description="Try adjusting your tag filters or search keyword."
                    onClearFilters={() => filters.clearAllFilters()} />
            {:else}
                <div
                    use:staggerChildren
                    class="stagger-children relative z-0 mt-2 grid grid-cols-1 gap-4">
                    {#each visiblePosts as post (post.id)}
                        <BlogPostCard
                            {post}
                            headingTag="h2"
                            tagItem={filterableTag} />
                    {/each}
                </div>
                <div class="mt-6">
                    <Pagination
                        page={pageClamped}
                        {totalPages}
                        onPageChange={p => (pageSelection = { key: filterKey, page: p })} />
                </div>
            {/if}
        </PageContainer>
    </Section>

    <FooterSection />
</main>
